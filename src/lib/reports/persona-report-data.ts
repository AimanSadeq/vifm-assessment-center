// ─────────────────────────────────────────────────────────────
// Persona report data builder (shared by the EN React-PDF route and the AR
// Chromium/HTML route). One assembly path so the two languages and the two
// purposes never drift. Everything is tolerant: missing migrations (00125
// report insights, 00126 report_extras, 00127 norms) degrade to deterministic
// copy / omitted sections, never an error.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { loadPersonaRoleById, type PersonaRoleOption } from "@/lib/scoring/persona-roles";
import { computeFit, competencyNarrative, developmentNarrative, FIT_BAND_HEX } from "@/lib/scoring/persona-fit";
import { personaBand } from "@/lib/scoring/persona-bands";
import {
  generatePersonaInsights,
  buildInsightCompetencies,
  generateInterviewProbes,
  generatePersonaSummary,
  type PersonaLang,
  type PersonaInsightCompetency,
} from "@/lib/ai/persona-insights";
import { computePersonaConsistency, type ConsistencyResponse } from "@/lib/scoring/persona-consistency";
import { resolveNormGroup, loadNorms, percentile } from "@/lib/scoring/persona-norms";
import { recommendCoursesForCompetencyGaps, HIGH_FIT_THRESHOLD, type RecommendedCourse } from "@/lib/recommender/courses";
import { VIFM_VERTICAL_LABELS } from "@/types/database";
import type {
  PersonaPdfData,
  PersonaPdfCluster,
  PersonaPdfInterviewGroup,
  PersonaPdfPlanRow,
} from "@/lib/reports/persona-profile";

export type PersonaPurpose = "development" | "hiring";

type SessionRow = {
  id: string;
  taker_name: string | null;
  purpose?: string | null;
  target_role_profile_id?: string | null;
  norm_group_id?: string | null;
  report_extras?: Record<string, LangExtras> | null;
};
type LangExtras = {
  summary?: string;
  interview_probes?: Record<string, string[]>;
};

export type BuildResult =
  | { ok: true; purpose: PersonaPurpose; data: PersonaPdfData }
  | { ok: false; status: number; error: string };

// CAL-PER-401: bump when the insight-generation rules change so previously
// cached narratives (e.g. ones written before the band-consistency guardrail)
// are treated as stale and regenerated on the next render. Stored under the
// reserved __v key inside competency_insights.
const INSIGHTS_VERSION = "v2-bandguard";

/** Lightweight purpose peek for the auth gate (so a hiring report stays
 *  admin-only without doing the heavy assembly first). Tolerant. */
export async function peekPersonaPurpose(sessionId: string): Promise<PersonaPurpose | "missing"> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("behavioral_assessment_sessions")
    .select("id, purpose")
    .eq("id", sessionId)
    .maybeSingle<{ id: string; purpose: string | null }>();
  if (error || !data) {
    if (error && /column .*purpose/i.test(error.message)) {
      const { data: basic } = await sb
        .from("behavioral_assessment_sessions")
        .select("id")
        .eq("id", sessionId)
        .maybeSingle<{ id: string }>();
      return basic ? "development" : "missing";
    }
    return "missing";
  }
  return data.purpose === "hiring" ? "hiring" : "development";
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function buildPersonaPdfData(sessionId: string, lang: PersonaLang = "en"): Promise<BuildResult> {
  const sb = createServiceClient();
  const ar = lang === "ar";

  // ── Session (tolerant of 00110 / 00126 / 00127 columns) ──
  let session: SessionRow | null = null;
  {
    const wide = await sb
      .from("behavioral_assessment_sessions")
      .select("id, taker_name, purpose, target_role_profile_id, norm_group_id, report_extras")
      .eq("id", sessionId)
      .maybeSingle();
    if (wide.error) {
      const mid = await sb
        .from("behavioral_assessment_sessions")
        .select("id, taker_name, purpose, target_role_profile_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (mid.error) {
        const basic = await sb
          .from("behavioral_assessment_sessions")
          .select("id, taker_name")
          .eq("id", sessionId)
          .maybeSingle();
        session = (basic.data as SessionRow) ?? null;
      } else {
        session = (mid.data as SessionRow) ?? null;
      }
    } else {
      session = (wide.data as SessionRow) ?? null;
    }
  }
  if (!session) return { ok: false, status: 404, error: "Session not found" };

  const purpose: PersonaPurpose = session.purpose === "hiring" ? "hiring" : "development";

  // ── Responses (with item_type / answer_data for the consistency signal) ──
  let responses: ConsistencyResponse[] = [];
  {
    const wide = await sb
      .from("behavioral_assessment_responses")
      .select("competency_id, raw_score, is_reverse, item_type, answer_data")
      .eq("session_id", sessionId);
    if (wide.error) {
      const basic = await sb
        .from("behavioral_assessment_responses")
        .select("competency_id, raw_score, is_reverse")
        .eq("session_id", sessionId);
      responses = (basic.data as ConsistencyResponse[]) ?? [];
    } else {
      responses = (wide.data as ConsistencyResponse[]) ?? [];
    }
  }
  if (responses.length === 0) return { ok: false, status: 400, error: "No answers recorded for this session yet" };

  // Per-competency self score (reverse mapped 6 - raw).
  const byComp = new Map<string, number[]>();
  for (const r of responses) {
    const raw = Number(r.raw_score);
    const v = r.is_reverse ? 6 - raw : raw;
    if (!byComp.has(r.competency_id)) byComp.set(r.competency_id, []);
    byComp.get(r.competency_id)!.push(v);
  }
  const scoreById = new Map<string, number>();
  for (const [cid, vals] of byComp) {
    scoreById.set(cid, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100);
  }

  // ── Definitions + dev tips ──
  const definitionById = new Map<string, string>();
  const tipById = new Map<string, string>();
  try {
    const { data: cat } = await sb.from("competencies").select("id, description");
    for (const c of cat ?? []) if (c.description) definitionById.set(c.id as string, String(c.description));
  } catch { /* tolerant */ }
  try {
    const { data: tips } = await sb
      .from("behavioral_indicators")
      .select("competency_id, description, sort_order")
      .like("description", "[DEV TIP]%")
      .order("sort_order", { ascending: true });
    for (const t of tips ?? []) {
      const cid = t.competency_id as string;
      if (!tipById.has(cid)) tipById.set(cid, String(t.description).replace(/^\[DEV TIP\]\s*/, ""));
    }
  } catch { /* tolerant */ }

  // ── Role (both purposes) ──
  const role: PersonaRoleOption | null = session.target_role_profile_id
    ? await loadPersonaRoleById(session.target_role_profile_id)
    : null;
  const targetById = new Map((role?.comps ?? []).map((c) => [c.competencyId, c.target]));

  // Role-critical marking (A.3): weight at/above the role median weight = critical.
  const roleMarkById = new Map<string, "critical" | "role">();
  if (role) {
    const med = median(role.comps.map((c) => (c.weight > 0 ? c.weight : 1)));
    for (const c of role.comps) {
      const w = c.weight > 0 ? c.weight : 1;
      roleMarkById.set(c.competencyId, w >= med ? "critical" : "role");
    }
  }

  // Localized name maps.
  const nameById = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, ar ? c.nameAr : c.nameEn]));

  // ── report_extras cache (00126) ──
  const extras: Record<string, LangExtras> =
    session.report_extras && typeof session.report_extras === "object" ? session.report_extras : {};
  const langExtras: LangExtras = extras[lang] ?? {};
  let extrasDirty = false;

  // ── Per-competency insight narratives (00125, separate column) ──
  let insightsById: Record<string, string> = {};
  try {
    const { data: ci } = await sb
      .from("behavioral_assessment_sessions")
      .select("competency_insights")
      .eq("id", sessionId)
      .maybeSingle<{ competency_insights: Record<string, string> | null }>();
    const raw = ci?.competency_insights;
    // CAL-PER-401: only trust the cache when its version matches; otherwise
    // leave insightsById empty so the narratives regenerate under the new rules.
    if (raw && typeof raw === "object" && raw.__v === INSIGHTS_VERSION) {
      const { __v, ...rest } = raw;
      void __v;
      insightsById = rest;
    }
  } catch { /* 00125 absent */ }

  // Build the role-competency insight inputs once (reused for narratives + probes).
  let insightComps: PersonaInsightCompetency[] = [];
  if (role) {
    try {
      insightComps = await buildInsightCompetencies({ sessionId, roleComps: role.comps, selfById: scoreById });
    } catch { /* tolerant */ }
  }

  // Lazy-generate the EN narratives (cached on competency_insights). For AR we
  // re-generate in Arabic but do not overwrite the EN cache column.
  if (role && insightComps.length > 0 && (Object.keys(insightsById).length === 0 || ar)) {
    try {
      insightsById = await generatePersonaInsights({ roleName: role.name, competencies: insightComps, purpose, lang });
      if (!ar) {
        try {
          await sb.from("behavioral_assessment_sessions").update({ competency_insights: { ...insightsById, __v: INSIGHTS_VERSION } }).eq("id", sessionId);
        } catch { /* 00125 absent */ }
      }
    } catch { /* deterministic fallback used below */ }
  }

  // ── Norms (00127) ──
  const normGroup = await resolveNormGroup(session.norm_group_id);
  const normMap = normGroup ? await loadNorms(normGroup.id) : new Map();
  const pctById = new Map<string, number>();
  for (const [cid, score] of scoreById) {
    const n = normMap.get(cid);
    if (n) {
      const p = percentile(score, n.mean, n.sd);
      if (p != null) pctById.set(cid, p);
    }
  }
  const pctValues = [...pctById.values()];
  const overallPercentile = pctValues.length ? Math.round(pctValues.reduce((a, b) => a + b, 0) / pctValues.length) : null;

  // ── Clusters ──
  const byCluster = new Map<number, PersonaPdfCluster>();
  for (const comp of BEHAVIORAL_COMPETENCIES) {
    const score = scoreById.get(comp.acCompetencyId);
    if (score == null) continue;
    if (!byCluster.has(comp.clusterOrder)) {
      byCluster.set(comp.clusterOrder, { name: ar ? comp.clusterNameAr : comp.clusterNameEn, avg: 0, rows: [] });
    }
    const rowTarget = role ? targetById.get(comp.acCompetencyId) ?? null : null;
    const fallbackNarr =
      purpose === "development" ? developmentNarrative(score, rowTarget, lang) : competencyNarrative(score, rowTarget, lang);
    byCluster.get(comp.clusterOrder)!.rows.push({
      name: nameById.get(comp.acCompetencyId) ?? comp.nameEn,
      score,
      definition: definitionById.get(comp.acCompetencyId),
      narrative: insightsById[comp.acCompetencyId] ?? fallbackNarr,
      tip: purpose === "development" && score < 3.5 ? tipById.get(comp.acCompetencyId) : undefined,
      roleMark: roleMarkById.get(comp.acCompetencyId) ?? null,
      target: rowTarget,
      overused: purpose === "development" && score >= 4.5,
      percentile: pctById.get(comp.acCompetencyId) ?? null,
    });
  }
  const clusters = [...byCluster.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, cl]) => ({ ...cl, avg: cl.rows.reduce((a, r) => a + r.score, 0) / cl.rows.length }));

  const all = [...scoreById.values()];
  const overall = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100 : 0;

  // ── Fit + courses + section content ──
  let fit: PersonaPdfData["fit"] = null;
  let courses: PersonaPdfData["courses"] = [];
  let interviewProbes: PersonaPdfInterviewGroup[] = [];
  let watchAreas: string[] = [];
  let planRows: PersonaPdfPlanRow[] = [];
  let summary: string | null = null;
  let coaching: PersonaPdfData["coaching"] = null;

  if (role) {
    const measuredComps = role.comps.filter((c) => scoreById.has(c.competencyId));
    const f = computeFit(scoreById, measuredComps);
    if (f) {
      const gapsTop = f.gaps.filter((g) => g.self != null && g.gap > 0).slice(0, 6);
      const strengthsTop = f.gaps
        .filter((g) => g.self != null && (g.self as number) >= g.target)
        .sort((a, b) => ((b.self as number) - b.target) - ((a.self as number) - a.target))
        .slice(0, 6);
      fit = {
        roleName: role.name,
        fitPct: f.fitPct,
        bandLabel: ar ? f.bandLabelAr : f.bandLabel,
        bandHex: FIT_BAND_HEX[f.band],
        // CAL-PER-407: display the top 5 priorities/strengths so the fit panel
        // matches the 5-row action plan (internal gapsTop stays 6 for course
        // recs / drivers / watch areas).
        gaps: gapsTop.slice(0, 5).map((g) => ({ name: nameById.get(g.competencyId) ?? g.name, self: g.self ?? 0, target: g.target, gap: g.gap })),
        strengths: strengthsTop.slice(0, 5).map((g) => ({ name: nameById.get(g.competencyId) ?? g.name, self: g.self ?? 0, target: g.target })),
      };

      let recs: RecommendedCourse[] = [];
      if (purpose === "development") {
        // Course plan.
        try {
          const gapInput = gapsTop.map((g) => {
            const comp = BEHAVIORAL_COMPETENCIES.find((c) => c.acCompetencyId === g.competencyId);
            return {
              competency_id: g.competencyId,
              name: comp?.nameEn ?? g.name,
              name_ar: comp?.nameAr ?? null,
              gap: g.gap,
            };
          });
          recs = await recommendCoursesForCompetencyGaps({ gaps: gapInput, limit: 6 });
          const top = Math.max(0, ...recs.map((c) => c.total_score));
          courses = recs.map((c) => ({
            title: ar && c.title_ar ? c.title_ar : c.title_en,
            code: c.course_code,
            vertical: VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical,
            level: c.level,
            durationLabel:
              c.min_duration_days === c.max_duration_days
                ? `${c.default_duration_days}d`
                : `${c.min_duration_days}-${c.max_duration_days}d`,
            fitOutOfTen: top > 0 ? Math.max(1, Math.round((c.total_score / top) * 10)) : 0,
            highFit: c.total_score >= HIGH_FIT_THRESHOLD,
            drivers: c.drivers.slice(0, 4).map((d) => ({ label: ar && d.label_ar ? d.label_ar : d.label, gap: d.gap, relevance: d.relevance })),
          }));
        } catch { /* best-effort */ }

        // B.2 planning scaffold: priority + a prefilled action (dev tip + matched
        // course code). Match against `recs` whose driver labels are the
        // language-stable ENGLISH competency names (the localized `courses`
        // labels would never match in Arabic).
        const courseCodeFor = (enName: string): string | null => {
          for (const c of recs) {
            if (c.course_code && c.drivers.some((d) => d.label === enName)) return c.course_code;
          }
          return recs[0]?.course_code ?? null;
        };
        planRows = gapsTop.slice(0, 5).map((g) => {
          const enName = BEHAVIORAL_COMPETENCIES.find((c) => c.acCompetencyId === g.competencyId)?.nameEn ?? g.name;
          const tip = tipById.get(g.competencyId);
          const code = courseCodeFor(enName);
          const base = tip || (ar ? "ممارسة موجّهة ومهام تطويرية" : "Targeted practice and a stretch assignment");
          const action = code ? `${base}${ar ? " · دورة VIFM " : " · VIFM course "}${code}` : base;
          return { competency: nameById.get(g.competencyId) ?? g.name, action };
        });

        // B.1 opening synthesis.
        const strengthNames = strengthsTop.slice(0, 3).map((g) => nameById.get(g.competencyId) ?? g.name);
        const priorityNames = gapsTop.slice(0, 3).map((g) => nameById.get(g.competencyId) ?? g.name);
        if (langExtras.summary) {
          summary = langExtras.summary;
        } else {
          try {
            summary = await generatePersonaSummary({
              roleName: role.name,
              overall,
              strengths: strengthNames,
              priorities: priorityNames,
              clusters: clusters.map((c) => ({ name: c.name, avg: c.avg })),
              lang,
            });
            langExtras.summary = summary;
            extrasDirty = true;
          } catch { summary = null; }
        }

        // B.3 coaching + self-reflection (deterministic, named).
        coaching = buildCoaching(priorityNames, strengthNames, ar);
      }

      if (purpose === "hiring") {
        // A.4 watch areas: role-critical comps well below target.
        watchAreas = gapsTop
          .filter((g) => {
            const mark = roleMarkById.get(g.competencyId);
            const self = g.self ?? 0;
            return mark === "critical" && (["requires_focus", "critical"].includes(personaBand(self).key) || g.gap >= 1.5);
          })
          .map((g) => nameById.get(g.competencyId) ?? g.name);

        // A.1 interview guide for the role-critical gap competencies (top 6).
        const criticalGapIds = new Set(gapsTop.map((g) => g.competencyId));
        const probeComps = insightComps.filter((c) => criticalGapIds.has(c.competencyId));
        let probeMap: Record<string, string[]> = langExtras.interview_probes ?? {};
        const haveAll = probeComps.every((c) => Array.isArray(probeMap[c.competencyId]) && probeMap[c.competencyId].length > 0);
        if (probeComps.length > 0 && !haveAll) {
          try {
            probeMap = await generateInterviewProbes({ roleName: role.name, competencies: probeComps, lang });
            langExtras.interview_probes = probeMap;
            extrasDirty = true;
          } catch { /* fall through to whatever cache we had */ }
        }
        interviewProbes = probeComps.map((c) => ({
          competencyId: c.competencyId,
          name: nameById.get(c.competencyId) ?? c.name,
          probes: probeMap[c.competencyId] ?? [],
        })).filter((g) => g.probes.length > 0);
      }
    }
  }

  // Development WITHOUT a target role: still attach to VIFM Academy by deriving
  // the gaps from the lowest self-ratings (against an aspirational target of 4),
  // so the course plan + summary + scaffold + coaching always render. When a role
  // IS bound the block above already did this against the role target.
  if (purpose === "development" && !fit) {
    const DEV_TARGET = 4;
    type DG = { competencyId: string; nameEn: string; nameAr: string; gap: number; score: number };
    const measured: DG[] = [];
    for (const c of BEHAVIORAL_COMPETENCIES) {
      const sc = scoreById.get(c.acCompetencyId);
      if (sc == null) continue;
      measured.push({ competencyId: c.acCompetencyId, nameEn: c.nameEn, nameAr: c.nameAr, gap: Math.max(0, DEV_TARGET - sc), score: sc });
    }
    const gapsTop = measured.filter((m) => m.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 6);
    const strengthsTop = measured.filter((m) => m.score >= 4).sort((a, b) => b.score - a.score).slice(0, 6);
    const nm = (m: DG) => (ar ? m.nameAr : m.nameEn);

    let recs: RecommendedCourse[] = [];
    try {
      const gapInput = gapsTop.map((m) => ({ competency_id: m.competencyId, name: m.nameEn, name_ar: m.nameAr, gap: m.gap }));
      recs = await recommendCoursesForCompetencyGaps({ gaps: gapInput, limit: 6 });
      const top = Math.max(0, ...recs.map((c) => c.total_score));
      courses = recs.map((c) => ({
        title: ar && c.title_ar ? c.title_ar : c.title_en,
        code: c.course_code,
        vertical: VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical,
        level: c.level,
        durationLabel:
          c.min_duration_days === c.max_duration_days
            ? `${c.default_duration_days}d`
            : `${c.min_duration_days}-${c.max_duration_days}d`,
        fitOutOfTen: top > 0 ? Math.max(1, Math.round((c.total_score / top) * 10)) : 0,
        highFit: c.total_score >= HIGH_FIT_THRESHOLD,
        drivers: c.drivers.slice(0, 4).map((d) => ({ label: ar && d.label_ar ? d.label_ar : d.label, gap: d.gap, relevance: d.relevance })),
      }));
    } catch { /* best-effort */ }

    const courseCodeFor = (enName: string): string | null => {
      for (const c of recs) if (c.course_code && c.drivers.some((d) => d.label === enName)) return c.course_code;
      return recs[0]?.course_code ?? null;
    };
    planRows = gapsTop.slice(0, 5).map((m) => {
      const tip = tipById.get(m.competencyId);
      const code = courseCodeFor(m.nameEn);
      const base = tip || (ar ? "ممارسة موجّهة ومهام تطويرية" : "Targeted practice and a stretch assignment");
      const action = code ? `${base}${ar ? " · دورة VIFM " : " · VIFM course "}${code}` : base;
      return { competency: nm(m), action };
    });

    const strengthNames = strengthsTop.slice(0, 3).map(nm);
    const priorityNames = gapsTop.slice(0, 3).map(nm);
    if (langExtras.summary) {
      summary = langExtras.summary;
    } else {
      try {
        summary = await generatePersonaSummary({
          roleName: null,
          overall,
          strengths: strengthNames,
          priorities: priorityNames,
          clusters: clusters.map((c) => ({ name: c.name, avg: c.avg })),
          lang,
        });
        langExtras.summary = summary;
        extrasDirty = true;
      } catch { summary = null; }
    }
    coaching = buildCoaching(priorityNames, strengthNames, ar);
  }

  // Persist any newly generated extras (tolerant of 00126 absent).
  if (extrasDirty) {
    try {
      const merged = { ...extras, [lang]: langExtras };
      await sb.from("behavioral_assessment_sessions").update({ report_extras: merged }).eq("id", sessionId);
    } catch { /* 00126 absent - used for this render only */ }
  }

  // ── Consistency (advisory, computed fresh) ──
  const consistency = computePersonaConsistency(responses, lang);

  const data: PersonaPdfData = {
    takerName: session.taker_name ?? null,
    generatedAt: new Date().toLocaleDateString(ar ? "ar" : "en-GB", { day: "numeric", month: "long", year: "numeric" }),
    overall,
    clusters,
    purpose,
    fit,
    courses,
    interviewProbes,
    watchAreas,
    summary,
    planRows,
    coaching,
    consistency: consistency ? { flag: consistency.flag, note: consistency.note } : null,
    overallPercentile,
    normGroupLabel: normGroup ? (ar ? normGroup.labelAr ?? normGroup.labelEn : normGroup.labelEn) : null,
    normProvisional: normGroup?.isProvisional ?? false,
    normN: pctValues.length > 0 ? minNormN(normMap) : null,
  };

  return { ok: true, purpose, data };
}

function minNormN(normMap: Map<string, { mean: number; sd: number; n: number }>): number | null {
  let min = Infinity;
  for (const v of normMap.values()) min = Math.min(min, v.n);
  return min === Infinity ? null : min;
}

// B.3 - deterministic coaching + self-reflection prompts seeded with the named
// top priorities and top strength. No AI; tailored but generic.
function buildCoaching(priorities: string[], strengths: string[], ar: boolean): PersonaPdfData["coaching"] {
  const p1 = priorities[0];
  const p2 = priorities[1];
  const s1 = strengths[0];
  if (ar) {
    const forConversation = [
      p1 ? `ما الفرصة القادمة التي يمكنك فيها ممارسة «${p1}» بشكل متعمّد؟` : `أين تركّز جهدك التطويري في الأشهر الثلاثة القادمة؟`,
      p2 ? `ما الدعم أو المهمة التي تساعدك على تطوير «${p2}»؟` : `ما نوع الدعم الذي تحتاجه من مديرك؟`,
      s1 ? `كيف يمكنك توظيف قوتك في «${s1}» لدعم مجالات التطوير لديك؟` : `كيف توظّف نقاط قوتك لدعم أهدافك؟`,
      `كيف ستعرف أنك أحرزت تقدّمًا خلال 90 يومًا؟`,
    ];
    const forSelf = [
      p1 ? `متى لاحظت آخر مرة أثر «${p1}» في عملك؟` : `ما المجال الذي تتجنّبه وقد يفيدك التركيز عليه؟`,
      `ما العادة الصغيرة التي يمكنك البدء بها هذا الأسبوع؟`,
      s1 ? `هل تعتمد على «${s1}» أكثر من اللازم على حساب مجالات أخرى؟` : `أين قد تُفرط في استخدام إحدى نقاط قوتك؟`,
      `من يمكن أن يكون قدوة أو مرشدًا لك في أولوياتك؟`,
    ];
    return { forConversation, forSelf };
  }
  const forConversation = [
    p1 ? `What upcoming opportunity could let you practise ${p1} deliberately?` : `Where will you focus your development over the next three months?`,
    p2 ? `What support or assignment would help you build ${p2}?` : `What support do you need from your manager?`,
    s1 ? `How can you use your strength in ${s1} to support your development areas?` : `How can your strengths support your goals?`,
    `How will we both know you have made progress in 90 days?`,
  ];
  const forSelf = [
    p1 ? `When did you last notice ${p1} making a difference in your work?` : `Which area are you avoiding that would repay focus?`,
    `What is one small habit you could start this week?`,
    s1 ? `Are you leaning on ${s1} so much that other areas get less attention?` : `Where might you be overusing a strength?`,
    `Who could be a role model or mentor for your priorities?`,
  ];
  return { forConversation, forSelf };
}
