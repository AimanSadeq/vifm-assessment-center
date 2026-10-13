// Bundle progress tracking (Ali's recommendations, 13 Oct 2026): one row per
// person with their status, how far they are in each section, when they last
// did anything, and whether they need a follow-up. Server-only; the rules for
// "needs follow-up" are pure functions so they can be tested.

import { createServiceClient } from "@/lib/supabase/server";
import type { BundleSettings } from "./bundle-settings";
import type { RosterRow } from "./roster";

import {
  followUpReason,
  latestIso as latest,
  type PersonProgress,
  type PersonStatus,
} from "./progress-shared";

export * from "./progress-shared";

type CandRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  consent_at: string | null;
  completed_at: string | null;
  scored_at?: string | null;
  created_at: string;
  updated_at: string | null;
  persona_session_id: string | null;
  cognitive_session_id: string | null;
  cognitive_result_id: string | null;
};
type SjtRow = { bundle_candidate_id: string; item_order: unknown; answers: unknown; submitted_at: string | null; updated_at: string | null };
type ContactRow = { roster_id: string | null; email_norm: string; created_at: string };

const candStatus = (c: CandRow | undefined): PersonStatus => {
  if (!c) return "not_started";
  if (c.status === "scored") return "scored";
  if (c.status === "completed") return "completed";
  return c.consent_at || c.status === "in_progress" ? "in_progress" : "signed_in";
};

/** Every person on the bundle: roster entries (started or not) and anyone who
 *  sat without being on the roster (an open link, or a reset test sitting). */
export async function loadBundleProgress(
  bundleId: string,
  roster: Array<RosterRow & { created_at?: string | null }>,
  settings: BundleSettings,
  stages: { sjt: boolean; logica: boolean; persona: boolean },
): Promise<PersonProgress[]> {
  const sb = createServiceClient();
  const fullSelect =
    "id, full_name, email, status, consent_at, completed_at, scored_at, created_at, updated_at, persona_session_id, cognitive_session_id, cognitive_result_id";
  let cands: CandRow[] = [];
  {
    const r = await sb.from("bundle_candidates").select(fullSelect).eq("bespoke_service_id", bundleId).limit(5000);
    if (r.error) {
      // 00237 not applied yet: no scored_at column.
      const r2 = await sb.from("bundle_candidates").select(fullSelect.replace(" scored_at,", "")).eq("bespoke_service_id", bundleId).limit(5000);
      cands = (r2.data ?? []) as unknown as CandRow[];
    } else cands = (r.data ?? []) as unknown as CandRow[];
  }
  const ids = cands.map((c) => c.id);

  const [sjtRows, psyRows, personaRows, contactRows] = await Promise.all([
    stages.sjt && ids.length
      ? sb.from("bundle_sjt_results").select("bundle_candidate_id, item_order, answers, submitted_at, updated_at").eq("bespoke_service_id", bundleId)
          .then((r) => (r.data ?? []) as SjtRow[], () => [] as SjtRow[])
      : Promise.resolve([] as SjtRow[]),
    stages.logica
      ? (async () => {
          const sess = cands.map((c) => c.cognitive_session_id).filter((x): x is string => !!x);
          if (!sess.length) return [] as Array<{ id: string; created_at: string }>;
          const r = await sb.from("psy_sessions").select("id, created_at").in("id", sess);
          return (r.data ?? []) as Array<{ id: string; created_at: string }>;
        })()
      : Promise.resolve([] as Array<{ id: string; created_at: string }>),
    stages.persona
      ? (async () => {
          const sess = cands.map((c) => c.persona_session_id).filter((x): x is string => !!x);
          if (!sess.length) return [] as Array<{ id: string; status: string; updated_at: string | null }>;
          const r = await sb.from("behavioral_assessment_sessions").select("id, status, updated_at").in("id", sess);
          return (r.data ?? []) as Array<{ id: string; status: string; updated_at: string | null }>;
        })()
      : Promise.resolve([] as Array<{ id: string; status: string; updated_at: string | null }>),
    sb.from("bundle_contact_log").select("roster_id, email_norm, created_at").eq("bespoke_service_id", bundleId).order("created_at", { ascending: false })
      .then((r) => (r.error ? [] : (r.data ?? [])) as ContactRow[], () => [] as ContactRow[]),
  ]);

  const candById = new Map(cands.map((c) => [c.id, c]));
  const sjtByCand = new Map(sjtRows.map((s) => [s.bundle_candidate_id, s]));
  const psyById = new Map(psyRows.map((p) => [p.id, p]));
  const personaById = new Map(personaRows.map((p) => [p.id, p]));
  const contactsByEmail = new Map<string, ContactRow[]>();
  for (const c of contactRows) {
    const k = c.email_norm.toLowerCase();
    if (!contactsByEmail.has(k)) contactsByEmail.set(k, []);
    contactsByEmail.get(k)!.push(c);
  }

  // Open since the release, or (a bundle never put on hold) since the person was added.
  const openSinceFor = (r: { created_at?: string | null } | null) => (settings.held ? null : settings.releasedAt ?? r?.created_at ?? null);
  const now = Date.now();

  const build = (r: (RosterRow & { created_at?: string | null }) | null, c: CandRow | undefined): PersonProgress => {
    const email = (r?.email_norm ?? c?.email ?? "").toLowerCase();
    const sjt = c ? sjtByCand.get(c.id) : undefined;
    const answered = sjt?.answers && typeof sjt.answers === "object" ? Object.keys(sjt.answers as object).length : 0;
    const total = Array.isArray(sjt?.item_order) ? (sjt!.item_order as unknown[]).length : 0;
    const psy = c?.cognitive_session_id ? psyById.get(c.cognitive_session_id) : undefined;
    const persona = c?.persona_session_id ? personaById.get(c.persona_session_id) : undefined;
    const contacts = contactsByEmail.get(email) ?? [];
    const status = candStatus(c);
    const p: PersonProgress = {
      key: r?.id ?? c!.id,
      rosterId: r?.id ?? null,
      candidateId: c?.id ?? null,
      name: r?.full_name ?? c?.full_name ?? "",
      email,
      grade: r?.grade ?? null,
      position: r?.position ?? null,
      businessUnit: r?.business_unit ?? null,
      employeeId: r?.employee_id ?? null,
      isTester: !!r?.is_tester,
      onRoster: !!r,
      status,
      startedAt: c?.created_at ?? null,
      consentAt: c?.consent_at ?? null,
      completedAt: c?.completed_at ?? null,
      scoredAt: c?.scored_at ?? null,
      lastActivityAt: c ? latest(c.created_at, c.consent_at, c.completed_at, c.updated_at, sjt?.updated_at, sjt?.submitted_at, psy?.created_at, persona?.updated_at) : null,
      sjt: stages.sjt ? { state: sjt?.submitted_at ? "done" : sjt ? "in_progress" : "not_started", answered, total } : null,
      logica: stages.logica ? (c?.cognitive_result_id ? "done" : c?.cognitive_session_id ? "in_progress" : "not_started") : null,
      persona: stages.persona ? (persona?.status === "submitted" ? "done" : persona ? "in_progress" : "not_started") : null,
      contacts: contacts.length,
      lastContactAt: contacts[0]?.created_at ?? null,
      followUp: null,
    };
    p.followUp = followUpReason(p, { held: settings.held, openSince: openSinceFor(r), followupDays: settings.followupDays, completeBy: settings.completeBy }, now);
    return p;
  };

  const out: PersonProgress[] = [];
  const linked = new Set<string>();
  for (const r of roster) {
    const c = r.bundle_candidate_id ? candById.get(r.bundle_candidate_id) : undefined;
    if (c) linked.add(c.id);
    out.push(build(r, c));
  }
  for (const c of cands) if (!linked.has(c.id)) out.push(build(null, c));
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

