// Competency quiz bank - admin/SME console data (server-only).
// Loads every behavioural competency with its quiz-item counts + items, so an
// SME can review and approve a competency's pool (which activates the bank for
// that competency in the Pre-Hire screen). Tolerant of migration 00180 absent.

import { createServiceClient } from "@/lib/supabase/server";

export type QuizBankStatus = "draft" | "in_review" | "approved" | "rejected" | "retired";
const STATUSES: QuizBankStatus[] = ["draft", "in_review", "approved", "rejected", "retired"];

export type QuizBankItem = {
  id: string;
  type: "multiple_choice" | "true_false" | "pattern_recognition";
  prompt_en: string;
  prompt_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  difficulty: "easy" | "medium" | "hard";
  explanation_en: string | null;
  status: QuizBankStatus;
  source: string;
  ar_reviewed: boolean;
};

export type CompetencyBank = {
  competencyId: string;
  name: string;
  counts: Record<QuizBankStatus, number>;
  approved: number;
  inReview: number;
  items: QuizBankItem[];
};

export type QuizBankView = {
  tableReady: boolean;
  competencies: CompetencyBank[];
  totals: { approved: number; inReview: number; draft: number; competenciesReady: number; total: number };
};

const emptyCounts = (): Record<QuizBankStatus, number> => ({ draft: 0, in_review: 0, approved: 0, rejected: 0, retired: 0 });
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** A competency has a servable pool once it clears this many APPROVED items. */
export const QUIZ_BANK_TARGET = 8;

type ItemRow = {
  id: string; competency_id: string; type: string;
  prompt_en: string; prompt_ar: string | null;
  options_en: unknown; options_ar: unknown; correct_index: number;
  difficulty: string | null; explanation_en: string | null;
  status: string; source: string | null; ar_reviewed: boolean | null;
};

export async function loadCompetencyQuizBank(): Promise<QuizBankView> {
  const svc = createServiceClient();
  const { data: comps } = await svc.from("competencies").select("id, name, sort_order").order("sort_order");
  const competencyList = (comps ?? []) as { id: string; name: string; sort_order: number }[];

  let tableReady = true;
  const byComp = new Map<string, QuizBankItem[]>();
  try {
    const { data, error } = await svc
      .from("competency_quiz_items")
      .select("id, competency_id, type, prompt_en, prompt_ar, options_en, options_ar, correct_index, difficulty, explanation_en, status, source, ar_reviewed")
      .order("status")
      .limit(5000);
    if (error) throw error;
    for (const r of (data ?? []) as ItemRow[]) {
      const item: QuizBankItem = {
        id: r.id,
        type: (["multiple_choice", "true_false", "pattern_recognition"] as const).includes(r.type as never)
          ? (r.type as QuizBankItem["type"]) : "multiple_choice",
        prompt_en: r.prompt_en,
        prompt_ar: r.prompt_ar,
        options_en: asStrArr(r.options_en),
        options_ar: r.options_ar == null ? null : asStrArr(r.options_ar),
        correct_index: r.correct_index,
        difficulty: (["easy", "medium", "hard"] as const).includes(r.difficulty as never) ? (r.difficulty as QuizBankItem["difficulty"]) : "medium",
        explanation_en: r.explanation_en,
        status: STATUSES.includes(r.status as never) ? (r.status as QuizBankStatus) : "draft",
        source: r.source ?? "ai_generated",
        ar_reviewed: !!r.ar_reviewed,
      };
      const arr = byComp.get(r.competency_id) ?? [];
      arr.push(item);
      byComp.set(r.competency_id, arr);
    }
  } catch {
    tableReady = false;
  }

  const competencies: CompetencyBank[] = competencyList.map((c) => {
    const items = byComp.get(c.id) ?? [];
    const counts = emptyCounts();
    for (const it of items) counts[it.status] += 1;
    return { competencyId: c.id, name: c.name, counts, approved: counts.approved, inReview: counts.in_review, items };
  });

  const totals = {
    approved: competencies.reduce((s, c) => s + c.approved, 0),
    inReview: competencies.reduce((s, c) => s + c.inReview, 0),
    draft: competencies.reduce((s, c) => s + c.counts.draft, 0),
    competenciesReady: competencies.filter((c) => c.approved >= QUIZ_BANK_TARGET).length,
    total: competencies.reduce((s, c) => s + c.items.length, 0),
  };
  return { tableReady, competencies, totals };
}
