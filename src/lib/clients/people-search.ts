import { createServiceClient } from "@/lib/supabase/server";
import { chunkIds } from "@/lib/ara/paginate";
import { personaReportLinks, type ReportLink } from "@/lib/clients/monitor";
import { usableIdentity } from "@/lib/privacy/purged";

/**
 * Find a person by name or email across every service on Caliber (Ahmad,
 * 3 Nov 2026: "there is no search on the platform by email address or name to
 * see whether he did Techno, for example"). One query, one list: each sitting
 * the person has, which service and client it belongs to, where it stands,
 * and the report when one exists. Read-only; the caller gates admin.
 *
 * Each source is best-effort and independent, so one missing table never
 * empties the whole result.
 */

export type PersonHit = {
  service: string;
  accent: string;
  name: string;
  email: string | null;
  client: string | null;
  /** Short state in plain words: Completed, Started (not submitted), Invited... */
  state: string;
  completed: boolean;
  /** The most useful date for the row: completion when done, else start or creation. */
  date: string | null;
  reports: ReportLink[];
  managePath: string | null;
};

export const PEOPLE_SEARCH_MIN = 2;
const PER_SOURCE = 50;

/** PostgREST `or=(... ilike ...)` cannot carry commas, parentheses or wildcards from user input. */
function pattern(q: string): string {
  const clean = q.replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim();
  return `*${clean}*`;
}

function humanize(s: string | null | undefined): string {
  if (!s) return "-";
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function person(name: string | null | undefined, email: string | null | undefined): { name: string; email: string | null } {
  return { name: usableIdentity(name)?.trim() || "Candidate", email: usableIdentity(email)?.trim() || null };
}

export async function searchPeople(rawQuery: string): Promise<PersonHit[]> {
  const q = rawQuery.trim();
  if (q.length < PEOPLE_SEARCH_MIN) return [];
  const sb = createServiceClient();
  const like = pattern(q);

  const acNames = new Map<string, string>();
  const araNames = new Map<string, string>();
  const nameOf = async (table: "organizations" | "ara_organizations", ids: (string | null | undefined)[], into: Map<string, string>) => {
    const want = Array.from(new Set(ids.filter((x): x is string => !!x && !into.has(x))));
    for (const chunk of chunkIds(want)) {
      const { data } = await sb.from(table).select("id, name").in("id", chunk);
      for (const o of (data ?? []) as { id: string; name: string }[]) into.set(o.id, o.name);
    }
  };

  const sources: Promise<PersonHit[]>[] = [
    // ARC: respondents of consultant-led, voucher and portal sittings alike.
    (async () => {
      const { data } = await sb
        .from("ara_respondents")
        .select("id, assessment_id, name, name_ar, email, completed_at, started_at, created_at, access_token")
        .or(`name.ilike.${like},name_ar.ilike.${like},email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; assessment_id: string; name: string | null; name_ar: string | null; email: string | null; completed_at: string | null; started_at: string | null; created_at: string; access_token: string | null };
      const rows = (data ?? []) as R[];
      if (rows.length === 0) return [];
      type A = { id: string; organization_id: string | null; scope_label: string | null; engagement_stage: string; include_individual_layer: boolean | null };
      const byAssessment = new Map<string, A>();
      for (const chunk of chunkIds(Array.from(new Set(rows.map((r) => r.assessment_id))))) {
        const { data: as } = await sb.from("ara_assessments").select("id, organization_id, scope_label, engagement_stage, include_individual_layer").in("id", chunk);
        for (const a of (as ?? []) as A[]) byAssessment.set(a.id, a);
      }
      await nameOf("ara_organizations", Array.from(byAssessment.values()).map((a) => a.organization_id), araNames);
      return rows.map((r) => {
        const a = byAssessment.get(r.assessment_id);
        const personal = !!a && (a.engagement_stage === "individual" || !!a.include_individual_layer);
        const done = !!r.completed_at;
        return {
          service: "AI Readiness Compass",
          accent: "#7c3aed",
          ...person(r.name, r.email),
          client: a?.organization_id ? araNames.get(a.organization_id) ?? null : null,
          state: done ? "Completed" : r.started_at ? "Started, not submitted" : "Invited",
          completed: done,
          date: r.completed_at ?? r.started_at ?? r.created_at,
          reports: done && personal && r.access_token ? [{ label: "Personal report", path: `/api/ara/personal/${r.access_token}/pdf` }] : [],
          managePath: a ? `/ara/consultant/assessments/${a.id}` : null,
        };
      });
    })(),

    // Persona
    (async () => {
      const { data } = await sb
        .from("behavioral_assessment_sessions")
        .select("id, taker_name, taker_email, status, submitted_at, started_at, created_at, organization_id")
        .or(`taker_name.ilike.${like},taker_email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; taker_name: string | null; taker_email: string | null; status: string; submitted_at: string | null; started_at: string | null; created_at: string; organization_id: string | null };
      const rows = (data ?? []) as R[];
      await nameOf("organizations", rows.map((r) => r.organization_id), acNames);
      return rows.map((r) => {
        const done = r.status === "submitted";
        return {
          service: "Persona",
          accent: "#0891b2",
          ...person(r.taker_name, r.taker_email),
          client: r.organization_id ? acNames.get(r.organization_id) ?? null : null,
          state: done ? "Completed" : "Started, not submitted",
          completed: done,
          date: r.submitted_at ?? r.started_at ?? r.created_at,
          reports: done ? personaReportLinks(r.id) : [],
          managePath: "/ac/persona/results",
        };
      });
    })(),

    // Logica (results exist only for completed sittings)
    (async () => {
      const { data } = await sb
        .from("psy_results")
        .select("id, taker_name, taker_email, created_at, organization_id")
        .or(`taker_name.ilike.${like},taker_email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; taker_name: string | null; taker_email: string | null; created_at: string; organization_id: string | null };
      const rows = (data ?? []) as R[];
      await nameOf("organizations", rows.map((r) => r.organization_id), acNames);
      return rows.map((r) => ({
        service: "Logica",
        accent: "#c026d3",
        ...person(r.taker_name, r.taker_email),
        client: r.organization_id ? acNames.get(r.organization_id) ?? null : null,
        state: "Completed",
        completed: true,
        date: r.created_at,
        reports: [{ label: "Report", path: `/api/ac/cognitive/${r.id}/report` }],
        managePath: "/ac/cognitive",
      }));
    })(),

    // Fluent (results exist only for completed sittings)
    (async () => {
      const { data } = await sb
        .from("eng_fluent_results")
        .select("id, taker_name, taker_email, created_at, organization_id, overall_cefr")
        .or(`taker_name.ilike.${like},taker_email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; taker_name: string | null; taker_email: string | null; created_at: string; organization_id: string | null; overall_cefr: string | null };
      const rows = (data ?? []) as R[];
      await nameOf("organizations", rows.map((r) => r.organization_id), acNames);
      return rows.map((r) => ({
        service: "Fluent",
        accent: "#d97706",
        ...person(r.taker_name, r.taker_email),
        client: r.organization_id ? acNames.get(r.organization_id) ?? null : null,
        state: r.overall_cefr ? `Completed · CEFR ${r.overall_cefr}` : "Completed",
        completed: true,
        date: r.created_at,
        reports: [{ label: "Report", path: `/api/ac/fluent/${r.id}/report` }],
        managePath: "/ac/fluent",
      }));
    })(),

    // Techno
    (async () => {
      const { data } = await sb
        .from("technical_sandbox_sessions")
        .select("id, candidate_name, candidate_email, status, submitted_at, started_at, expires_at, created_at, organization_id, organization_name, access_token, overall_band")
        .or(`candidate_name.ilike.${like},candidate_email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; candidate_name: string | null; candidate_email: string | null; status: string; submitted_at: string | null; started_at: string | null; expires_at: string | null; created_at: string; organization_id: string | null; organization_name: string | null; access_token: string; overall_band: string | null };
      const rows = (data ?? []) as R[];
      await nameOf("organizations", rows.map((r) => r.organization_id), acNames);
      return rows.map((r) => {
        const done = !!r.submitted_at;
        const expired = !!r.expires_at && new Date(r.expires_at).getTime() < Date.now();
        return {
          service: "Techno",
          accent: "#4f46e5",
          ...person(r.candidate_name, r.candidate_email),
          client: (r.organization_id ? acNames.get(r.organization_id) : null) ?? r.organization_name ?? null,
          state: done ? (r.overall_band ? `Completed · ${r.overall_band}` : "Completed") : r.started_at ? (expired ? "Started, time ran out, not submitted" : "Started, not submitted") : "Redeemed, not started",
          completed: done,
          date: r.submitted_at ?? r.started_at ?? r.created_at,
          reports: done ? [{ label: "Report", path: `/api/tech-sandbox/${r.access_token}/report` }] : [],
          managePath: done ? `/admin/tech-sandbox/results/${r.access_token}` : "/admin/tech-sandbox",
        };
      });
    })(),

    // Pre-Hire / Assessment Center candidates
    (async () => {
      const { data } = await sb
        .from("candidates")
        .select("id, engagement_id, full_name, email, status, updated_at, created_at")
        .or(`full_name.ilike.${like},email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; engagement_id: string; full_name: string | null; email: string | null; status: string; updated_at: string; created_at: string };
      const rows = (data ?? []) as R[];
      if (rows.length === 0) return [];
      type E = { id: string; name: string; organization_id: string | null };
      const byEng = new Map<string, E>();
      for (const chunk of chunkIds(Array.from(new Set(rows.map((r) => r.engagement_id))))) {
        const { data: es } = await sb.from("engagements").select("id, name, organization_id").in("id", chunk);
        for (const e of (es ?? []) as E[]) byEng.set(e.id, e);
      }
      await nameOf("organizations", Array.from(byEng.values()).map((e) => e.organization_id), acNames);
      return rows.map((r) => {
        const e = byEng.get(r.engagement_id);
        const done = r.status === "completed";
        return {
          service: "Pre-Hire / Assessment Center",
          accent: "#e11d48",
          ...person(r.full_name, r.email),
          client: e?.organization_id ? acNames.get(e.organization_id) ?? null : null,
          state: `${humanize(r.status)}${e ? ` · ${e.name}` : ""}`,
          completed: done,
          date: done ? r.updated_at : r.created_at,
          reports: done ? [{ label: "Candidate report", path: `/api/admin/prehire/${r.engagement_id}/candidate/${r.id}/report` }] : [],
          managePath: `/admin/engagements/${r.engagement_id}`,
        };
      });
    })(),

    // Bespoke bundles
    (async () => {
      const { data } = await sb
        .from("bundle_candidates")
        .select("id, bespoke_service_id, organization_id, full_name, email, status, scored_at, completed_at, created_at")
        .or(`full_name.ilike.${like},email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; bespoke_service_id: string; organization_id: string | null; full_name: string | null; email: string | null; status: string; scored_at: string | null; completed_at: string | null; created_at: string };
      const rows = (data ?? []) as R[];
      if (rows.length === 0) return [];
      const bundleName = new Map<string, string>();
      for (const chunk of chunkIds(Array.from(new Set(rows.map((r) => r.bespoke_service_id))))) {
        const { data: bs } = await sb.from("bespoke_services").select("id, name_en").in("id", chunk);
        for (const b of (bs ?? []) as { id: string; name_en: string }[]) bundleName.set(b.id, b.name_en);
      }
      await nameOf("organizations", rows.map((r) => r.organization_id), acNames);
      return rows.map((r) => {
        const done = r.status === "completed" || r.status === "scored" || !!r.scored_at;
        const bundle = bundleName.get(r.bespoke_service_id);
        return {
          service: "Bespoke bundle",
          accent: "#334155",
          ...person(r.full_name, r.email),
          client: r.organization_id ? acNames.get(r.organization_id) ?? null : null,
          state: `${r.scored_at ? "Scored" : humanize(r.status)}${bundle ? ` · ${bundle}` : ""}`,
          completed: done,
          date: r.scored_at ?? r.completed_at ?? r.created_at,
          reports: [],
          managePath: `/admin/bespoke/${r.bespoke_service_id}`,
        };
      });
    })(),

    // Reflect 360 participants
    (async () => {
      const { data } = await sb
        .from("reflect_participants")
        .select("id, engagement_id, full_name, full_name_ar, email, status, updated_at, created_at")
        .or(`full_name.ilike.${like},full_name_ar.ilike.${like},email.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE);
      type R = { id: string; engagement_id: string; full_name: string | null; full_name_ar: string | null; email: string | null; status: string; updated_at: string; created_at: string };
      const rows = (data ?? []) as R[];
      if (rows.length === 0) return [];
      type E = { id: string; name: string; organization_id: string | null };
      const byEng = new Map<string, E>();
      for (const chunk of chunkIds(Array.from(new Set(rows.map((r) => r.engagement_id))))) {
        const { data: es } = await sb.from("reflect_engagements").select("id, name, organization_id").in("id", chunk);
        for (const e of (es ?? []) as E[]) byEng.set(e.id, e);
      }
      await nameOf("ara_organizations", Array.from(byEng.values()).map((e) => e.organization_id), araNames);
      return rows.map((r) => {
        const e = byEng.get(r.engagement_id);
        const done = r.status === "closed" || r.status === "report_released";
        return {
          service: "Reflect 360",
          accent: "#0d9488",
          ...person(r.full_name, r.email),
          client: e?.organization_id ? araNames.get(e.organization_id) ?? null : null,
          state: `${humanize(r.status)}${e ? ` · ${e.name}` : ""}`,
          completed: done,
          date: done ? r.updated_at : r.created_at,
          reports: done ? [{ label: "Reflect report", path: `/api/reflect/reports/${r.id}/pdf` }] : [],
          managePath: `/reflect/consultant/engagements/${r.engagement_id}`,
        };
      });
    })(),
  ];

  const settled = await Promise.allSettled(sources);
  const hits: PersonHit[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") hits.push(...s.value);
    else console.error("[people-search] source failed:", s.reason instanceof Error ? s.reason.message : s.reason);
  }
  hits.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return hits;
}
