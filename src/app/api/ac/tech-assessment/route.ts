/**
 * Technical Competency Assessment API.
 *
 * POST { action: "start", domainKey }
 *   -> { session_id, test }   (test is answer-key STRIPPED; full test held
 *      server-side in tech_assessment_sessions)
 * POST { action: "score", sessionId, answers, takerName?, takerEmail?, ... }
 *   -> TechResult            (server reloads the stored test and grades it)
 *
 * Integrity: the answer key never reaches the browser. If tech_assessment_*
 * tables aren't migrated yet (00052), both actions fall back to the legacy
 * client-graded path (full test to the browser) so deployment is non-breaking.
 * Indicative proficiency only — never a certified score.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateTechnicalAssessment,
  scoreTechnicalAssessment,
  stripAnswerKey,
  type TechTest,
  type TechItem,
} from "@/lib/ai/technical-assessment";
import { techDomainByKey, type TechDomainKey } from "@/lib/competencies/technical-framework";

export const dynamic = "force-dynamic";

type Body = {
  action?: "start" | "score";
  domainKey?: string;
  sessionId?: string;
  items?: TechItem[]; // legacy client-graded path only
  domainName?: string;
  aiGenerated?: boolean;
  answers?: Record<string, number>;
  takerName?: string | null;
  takerEmail?: string | null;
  candidateId?: string | null;
  engagementId?: string | null;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 3;

async function createSession(
  test: TechTest,
  meta: { candidateId: string | null; engagementId: string | null }
): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("tech_assessment_sessions")
      .insert({
        domain_key: test.domain_key,
        ui_language: "en",
        test,
        candidate_id: meta.candidateId,
        engagement_id: meta.engagementId,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

async function loadSession(id: string): Promise<TechTest | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("tech_assessment_sessions")
      .select("test, expires_at")
      .eq("id", id)
      .single();
    if (error || !data || !data.test) return null;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
    try {
      await sb.from("tech_assessment_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", id);
    } catch {
      /* ignore */
    }
    return data.test as TechTest;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const domainKey = body.domainKey as TechDomainKey | undefined;

  if (body.action === "start") {
    if (!domainKey || !techDomainByKey(domainKey)) {
      return NextResponse.json({ error: "valid domainKey required" }, { status: 400 });
    }
    const test = await generateTechnicalAssessment({ domainKey });
    const candidateId = body.candidateId?.trim() || null;
    const engagementId = body.engagementId?.trim() || null;
    const session_id = await createSession(test, { candidateId, engagementId });
    if (session_id) {
      return NextResponse.json({ session_id, test: stripAnswerKey(test) });
    }
    // Legacy (sessions table not migrated): full test client-side.
    return NextResponse.json({ ...test });
  }

  if (body.action === "score") {
    let test: TechTest | null = null;
    if (body.sessionId) {
      test = await loadSession(body.sessionId);
      if (!test) return NextResponse.json({ error: "invalid or expired session" }, { status: 400 });
    } else if (Array.isArray(body.items) && domainKey) {
      const domain = techDomainByKey(domainKey);
      test = {
        domain_key: domainKey,
        domain_name: body.domainName || domain?.name || domainKey,
        items: body.items,
        ai_generated: body.aiGenerated === true,
      };
    }
    if (!test) {
      return NextResponse.json({ error: "a valid session (or items + domainKey) is required" }, { status: 400 });
    }

    const result = scoreTechnicalAssessment({ test, answers: body.answers ?? {} });

    const takerName = body.takerName?.trim() || null;
    const takerEmail = body.takerEmail?.trim() || null;

    // Persist (best-effort; table exists only after 00052).
    try {
      const sb = createServiceClient();
      await sb.from("tech_assessment_results").insert({
        taker_name: takerName,
        taker_email: takerEmail,
        domain_key: result.domain_key,
        ui_language: "en",
        score_correct: result.correct,
        score_total: result.total,
        score_pct: result.pct,
        level: result.proficiency.level,
        level_label: result.proficiency.label,
        result,
        ai_generated: result.ai_generated,
        candidate_id: body.candidateId?.trim() || null,
        engagement_id: body.engagementId?.trim() || null,
      });
    } catch {
      /* table not migrated — return the result anyway */
    }

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "action must be 'start' or 'score'" }, { status: 400 });
}
