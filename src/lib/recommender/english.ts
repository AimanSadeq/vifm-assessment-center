/**
 * English-development course recommender for the Fluent placement report.
 *
 * Fluent measures English; the natural next step is English / communication
 * development. Two sources feed one recommendation block:
 *
 *   VIFM    - the real vifm_courses catalogue, matched to communication-oriented
 *             behavioural competencies (no fabricated courses). Only surfaced
 *             when the candidate is below working proficiency (< C1), since a
 *             proficient speaker needs no English-development push.
 *   Partner - the partner_courses table (e.g. SE Training Academy), matched by
 *             CEFR band and (optionally) the candidate's weakest skill. Stays
 *             empty until a partner's list is added (migration 00146); tolerant
 *             of the table not existing yet.
 *
 * Server-side only (the report route runs under the service client / staff gate).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { VIFM_VERTICAL_LABELS, type VifmVertical, type VifmCourseLevel } from "@/types/database";
import type { FluentResult } from "@/lib/ai/fluent-english";

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Cefr = (typeof CEFR_ORDER)[number];

function cefrIndex(c: string | null | undefined): number {
  const i = CEFR_ORDER.indexOf((c ?? "") as Cefr);
  return i < 0 ? 0 : i;
}

// Workplace-English development target. At or above this (C1) the candidate is
// broadly proficient, so we do not push English-development courses from VIFM.
const TARGET_INDEX = CEFR_ORDER.indexOf("C1"); // 4

// Communication-oriented competencies are identified by keyword on the 41 names
// (robust to exact naming), so VIFM's communication/influence/presentation
// programmes surface without a hand-maintained id list.
const COMM_KEYWORDS = [
  "communicat", "influenc", "present", "persuad", "network",
  "stakeholder", "collaborat", "relationship", "negotiat",
];

const SKILL_LABEL: Record<string, string> = {
  reading: "reading", listening: "listening", writing: "writing", speaking: "speaking", general: "overall English",
};

export type EnglishCourseRec = {
  source: "vifm" | "partner";
  provider_label: string;
  code: string | null;
  title_en: string;
  title_ar: string | null;
  level_label: string | null;
  focus: string | null;
  url: string | null;
  reason_en: string;
};

export type EnglishRecommendations = {
  vifm: EnglishCourseRec[];
  partner: EnglishCourseRec[];
  weakest: { skill: string; cefr: string } | null;
};

type ServiceClient = ReturnType<typeof createServiceClient>;

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The candidate's weakest measured skill (lowest CEFR band among attempted skills). */
function weakestSkill(r: FluentResult): { skill: string; cefr: string } | null {
  const skills: Array<{ skill: string; cefr: string; index: number }> = [
    { skill: "reading", cefr: r.reading_cefr, index: cefrIndex(r.reading_cefr) },
  ];
  if (r.listening_total > 0) {
    skills.push({ skill: "listening", cefr: r.listening_cefr, index: cefrIndex(r.listening_cefr) });
  }
  skills.push({ skill: "writing", cefr: r.writing.cefr, index: cefrIndex(r.writing.cefr) });
  if (r.speaking.attempted) {
    skills.push({ skill: "speaking", cefr: r.speaking.cefr, index: cefrIndex(r.speaking.cefr) });
  }
  skills.sort((a, b) => a.index - b.index);
  return skills.length ? { skill: skills[0].skill, cefr: skills[0].cefr } : null;
}

export async function recommendEnglishDevelopment(args: {
  result: FluentResult;
  vifmLimit?: number;
  partnerLimit?: number;
}): Promise<EnglishRecommendations> {
  const r = args.result;
  const sb = createServiceClient();
  const overallIdx = cefrIndex(r.overall_cefr);
  const weak = weakestSkill(r);

  const vifm = await vifmCommunicationCourses(sb, overallIdx, args.vifmLimit ?? 4);
  const partner = await partnerEnglishCourses(sb, r.overall_cefr, weak?.skill ?? null, args.partnerLimit ?? 4);
  return { vifm, partner, weakest: weak };
}

// ── VIFM catalogue (communication-oriented competencies) ──────────

type CommTagJoin = {
  competency_id: string;
  relevance_weight: number | null;
  vifm_courses: {
    id: string;
    code: string | null;
    title_en: string;
    title_ar: string | null;
    vertical: VifmVertical;
    level: VifmCourseLevel;
    is_active: boolean;
  } | null;
};

async function vifmCommunicationCourses(
  sb: ServiceClient,
  overallIdx: number,
  limit: number
): Promise<EnglishCourseRec[]> {
  // Proficient candidates (>= C1) need no English-development recommendation.
  if (overallIdx >= TARGET_INDEX) return [];
  const gap = TARGET_INDEX - overallIdx; // 1..4 - bigger when further below proficiency

  const { data: comps } = await sb.from("competencies").select("id, name");
  const rows = (comps ?? []) as Array<{ id: string; name: string }>;
  const commIds = rows
    .filter((c) => COMM_KEYWORDS.some((k) => c.name.toLowerCase().includes(k)))
    .map((c) => c.id);
  if (commIds.length === 0) return [];

  const { data: tagRows } = await sb
    .from("vifm_course_competency_tags")
    .select(
      "competency_id, relevance_weight, " +
        "vifm_courses(id, code, title_en, title_ar, vertical, level, is_active)"
    )
    .in("competency_id", commIds);
  const tags = (tagRows ?? []) as unknown as CommTagJoin[];

  const acc = new Map<string, { rec: EnglishCourseRec; score: number }>();
  for (const t of tags) {
    const c = t.vifm_courses;
    if (!c || !c.is_active) continue;
    const contribution = gap * (t.relevance_weight ?? 1);
    const existing = acc.get(c.id);
    if (existing) {
      existing.score += contribution;
    } else {
      acc.set(c.id, {
        score: contribution,
        rec: {
          source: "vifm",
          provider_label: "VIFM",
          code: c.code,
          title_en: c.title_en,
          title_ar: c.title_ar,
          level_label: titleCase(c.level),
          focus: null,
          url: null,
          reason_en: `Builds workplace communication capability (${VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical}).`,
        },
      });
    }
  }

  return Array.from(acc.values())
    .sort((a, b) => b.score - a.score || a.rec.title_en.localeCompare(b.rec.title_en))
    .slice(0, limit)
    .map((x) => x.rec);
}

// ── Partner catalogue (e.g. SE Training Academy) ──────────────────

type PartnerRow = {
  id: string;
  provider: string;
  provider_label: string | null;
  code: string | null;
  title_en: string;
  title_ar: string | null;
  description_en: string | null;
  cefr_levels: string[] | null;
  focus_skill: string | null;
  url: string | null;
  sort_order: number | null;
};

function providerLabel(provider: string): string {
  if (provider === "se_academy") return "SE Training Academy";
  if (provider === "vifm") return "VIFM";
  return titleCase(provider.replace(/_/g, " "));
}

async function partnerEnglishCourses(
  sb: ServiceClient,
  overallCefr: string,
  weakSkill: string | null,
  limit: number
): Promise<EnglishCourseRec[]> {
  let rows: PartnerRow[] = [];
  try {
    const { data, error } = await sb
      .from("partner_courses")
      .select(
        "id, provider, provider_label, code, title_en, title_ar, description_en, cefr_levels, focus_skill, url, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) return []; // table not migrated yet, or transient - stay dark
    rows = (data ?? []) as unknown as PartnerRow[];
  } catch {
    return [];
  }
  if (rows.length === 0) return [];

  // Suit the candidate's band: a course matches if it lists no specific band
  // (suits all) or covers the candidate's band or the next step up.
  const idx = cefrIndex(overallCefr);
  const bandsOfInterest = new Set<string>([CEFR_ORDER[idx], CEFR_ORDER[Math.min(idx + 1, CEFR_ORDER.length - 1)]]);
  const matched = rows.filter(
    (c) => !c.cefr_levels || c.cefr_levels.length === 0 || c.cefr_levels.some((b) => bandsOfInterest.has(b))
  );

  // Float courses focused on the candidate's weakest skill first, then sort_order.
  matched.sort((a, b) => {
    const af = a.focus_skill === weakSkill ? 0 : 1;
    const bf = b.focus_skill === weakSkill ? 0 : 1;
    if (af !== bf) return af - bf;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  return matched.slice(0, limit).map((c) => ({
    source: "partner" as const,
    provider_label: c.provider_label || providerLabel(c.provider),
    code: c.code,
    title_en: c.title_en,
    title_ar: c.title_ar,
    level_label: c.cefr_levels && c.cefr_levels.length ? c.cefr_levels.join(", ") : "All levels",
    focus: c.focus_skill,
    url: c.url,
    reason_en:
      c.description_en?.trim() ||
      (c.focus_skill
        ? `English development with a focus on ${SKILL_LABEL[c.focus_skill] ?? c.focus_skill}.`
        : "English-language development programme."),
  }));
}
