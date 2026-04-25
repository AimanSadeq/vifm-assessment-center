import { createServiceClient } from "@/lib/supabase/server";
import type { AraPillarId } from "@/types/ara";
import { ARA_PILLAR_MAP } from "@/lib/constants/ara-pillars";

// ─────────────────────────────────────────────────────────────
// Gap Detector (handover §9.5)
// Flags two kinds of disagreement:
//   (a) Same question answered by ≥2 respondents with a score spread
//       greater than 2 points.
//   (b) Per-pillar average score by one respondent is Level 4–5 while
//       another respondent on the same pillar is at Level 1–2.
// ─────────────────────────────────────────────────────────────

export type GapAlert =
  | {
      kind: "question";
      pillar_id: AraPillarId;
      pillar_name_en: string;
      question_number: number;
      question_text_en: string;
      spread: number;
      low_respondent: string;
      low_score: number;
      high_respondent: string;
      high_score: number;
    }
  | {
      kind: "pillar";
      pillar_id: AraPillarId;
      pillar_name_en: string;
      low_respondent: string;
      low_avg: number;
      high_respondent: string;
      high_avg: number;
    };

export async function detectAraGaps(assessmentId: string): Promise<GapAlert[]> {
  const sb = createServiceClient();

  type Row = {
    question_score: number | null;
    question: { id: string; pillar_id: string; question_number: number; question_text_en: string } | null;
    respondent: { id: string; name: string } | null;
  };

  const { data: rows } = await sb
    .from("ara_responses")
    .select(`
      question_score,
      question:ara_questions(id, pillar_id, question_number, question_text_en),
      respondent:ara_respondents(id, name)
    `)
    .eq("assessment_id", assessmentId);

  const typed = (rows ?? []) as unknown as Row[];

  const alerts: GapAlert[] = [];

  // ─── (a) Per-question disagreement ───────────────────────────
  const byQuestion = new Map<
    string,
    { pillar_id: string; question_number: number; question_text_en: string; items: { name: string; score: number }[] }
  >();
  for (const r of typed) {
    if (r.question_score == null || !r.question || !r.respondent) continue;
    const key = r.question.id;
    const entry = byQuestion.get(key) ?? {
      pillar_id: r.question.pillar_id,
      question_number: r.question.question_number,
      question_text_en: r.question.question_text_en,
      items: [],
    };
    entry.items.push({ name: r.respondent.name, score: Number(r.question_score) });
    byQuestion.set(key, entry);
  }

  for (const entry of byQuestion.values()) {
    if (entry.items.length < 2) continue;
    const sorted = [...entry.items].sort((a, b) => a.score - b.score);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    const spread = Number((high.score - low.score).toFixed(2));
    if (spread > 2) {
      const pillar = ARA_PILLAR_MAP[entry.pillar_id as AraPillarId];
      alerts.push({
        kind: "question",
        pillar_id: entry.pillar_id as AraPillarId,
        pillar_name_en: pillar?.name_en ?? entry.pillar_id,
        question_number: entry.question_number,
        question_text_en: entry.question_text_en,
        spread,
        low_respondent: low.name,
        low_score: low.score,
        high_respondent: high.name,
        high_score: high.score,
      });
    }
  }

  // ─── (b) Per-pillar L4–5 vs L1–2 split ───────────────────────
  const byPillarByRespondent = new Map<string, Map<string, { name: string; scores: number[] }>>();
  for (const r of typed) {
    if (r.question_score == null || !r.question || !r.respondent) continue;
    const pillar = r.question.pillar_id;
    const perRespondent = byPillarByRespondent.get(pillar) ?? new Map();
    const rec = perRespondent.get(r.respondent.id) ?? { name: r.respondent.name, scores: [] };
    rec.scores.push(Number(r.question_score));
    perRespondent.set(r.respondent.id, rec);
    byPillarByRespondent.set(pillar, perRespondent);
  }

  for (const [pillarId, respMap] of byPillarByRespondent.entries()) {
    const avgs = Array.from(respMap.values())
      .map((r) => ({ name: r.name, avg: r.scores.reduce((a, b) => a + b, 0) / r.scores.length }))
      .filter((r) => Number.isFinite(r.avg));
    if (avgs.length < 2) continue;

    const leading = avgs.filter((a) => a.avg >= 4.0);
    const lagging = avgs.filter((a) => a.avg < 3.0);
    if (leading.length > 0 && lagging.length > 0) {
      const pillar = ARA_PILLAR_MAP[pillarId as AraPillarId];
      // Report the sharpest pair
      const high = leading.reduce((a, b) => (a.avg > b.avg ? a : b));
      const low = lagging.reduce((a, b) => (a.avg < b.avg ? a : b));
      alerts.push({
        kind: "pillar",
        pillar_id: pillarId as AraPillarId,
        pillar_name_en: pillar?.name_en ?? pillarId,
        low_respondent: low.name,
        low_avg: Number(low.avg.toFixed(2)),
        high_respondent: high.name,
        high_avg: Number(high.avg.toFixed(2)),
      });
    }
  }

  return alerts;
}

// ─────────────────────────────────────────────────────────────
// Shadow AI Alert (handover §11.4)
// Fires when responses indicate shadow AI usage without governance.
// Heuristic:
//   Shadow-signal = open-text answer mentions a public AI tool
//                   (ChatGPT, Copilot, Gemini, Claude, etc.), OR
//                   any governance-pillar question scored ≤ 2.0 that
//                   relates to AI acceptable-use policy.
// The alert's business purpose is always "investigate" - so a broad
// text-match is OK. Consultants dismiss false positives.
// ─────────────────────────────────────────────────────────────

const SHADOW_AI_KEYWORDS = [
  "chatgpt", "chat gpt", "copilot", "gemini", "claude", "bard",
  "perplexity", "midjourney", "dall-e", "llm", "generative ai",
  "الذكاء الاصطناعي التوليدي", "شات جي بي تي",
];

export type ShadowAiAlert = {
  triggered: boolean;
  matches: Array<{
    respondent_name: string;
    question_number: number | null;
    question_text_en: string | null;
    snippet: string;
    keyword: string;
  }>;
  low_governance_scores: Array<{
    respondent_name: string;
    question_number: number;
    question_text_en: string;
    score: number;
  }>;
};

export async function detectAraShadowAi(assessmentId: string): Promise<ShadowAiAlert> {
  const sb = createServiceClient();

  type Row = {
    answer_text: string | null;
    question_score: number | null;
    question: { pillar_id: string; question_number: number; question_text_en: string } | null;
    respondent: { name: string } | null;
  };

  const { data } = await sb
    .from("ara_responses")
    .select(`
      answer_text,
      question_score,
      question:ara_questions(pillar_id, question_number, question_text_en),
      respondent:ara_respondents(name)
    `)
    .eq("assessment_id", assessmentId);

  const typed = (data ?? []) as unknown as Row[];

  const matches: ShadowAiAlert["matches"] = [];
  const lowGov: ShadowAiAlert["low_governance_scores"] = [];

  for (const r of typed) {
    const lower = (r.answer_text ?? "").toLowerCase();
    if (lower) {
      for (const kw of SHADOW_AI_KEYWORDS) {
        if (lower.includes(kw)) {
          const idx = lower.indexOf(kw);
          const snippet = (r.answer_text ?? "").slice(
            Math.max(0, idx - 30),
            Math.min(r.answer_text!.length, idx + kw.length + 30)
          );
          matches.push({
            respondent_name: r.respondent?.name ?? "-",
            question_number: r.question?.question_number ?? null,
            question_text_en: r.question?.question_text_en ?? null,
            snippet,
            keyword: kw,
          });
          break; // one match per answer is enough
        }
      }
    }
    if (
      r.question?.pillar_id === "governance" &&
      r.question_score != null &&
      Number(r.question_score) <= 2.0
    ) {
      lowGov.push({
        respondent_name: r.respondent?.name ?? "-",
        question_number: r.question.question_number,
        question_text_en: r.question.question_text_en,
        score: Number(r.question_score),
      });
    }
  }

  return {
    triggered: matches.length > 0 || lowGov.length > 0,
    matches,
    low_governance_scores: lowGov,
  };
}
