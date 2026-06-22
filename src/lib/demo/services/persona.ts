// Persona (behavioural self-assessment) demo seeder. Populates the standalone
// (voucher / self-served) Persona surfaces - /ac/persona/results and
// /ac/persona/cohort - both of which read SUBMITTED sessions where
// candidate_id IS NULL, join the client org by organization_id, and compute the
// overall self-rating + item count purely from behavioral_assessment_responses.
//
// We therefore seed sessions + responses (the data those screens actually read).
// behavioral_competency_scores is intentionally NOT written: its engagement_id /
// candidate_id are NOT NULL, and per migration 00098 a standalone (anonymous)
// run has no candidate/engagement to roll up to - production scores those runs
// in-memory and never writes that table. Mirroring that keeps the demo honest.
//
// Tables touched: behavioral_assessment_sessions, behavioral_assessment_responses.
// Org-scoped via behavioral_assessment_sessions.organization_id (= org.organizationId,
// FK to organizations); taker emails also carry the demo sentinel domain.

import type { DemoServiceModule, DemoSb, DemoOrgIds } from "./types";
import { DEMO_EMAIL_DOMAIN } from "../constants";
import type { DemoSeedOutcome, DemoServiceCount } from "../constants";

const SERVICE = "persona";
const LABEL = "Persona";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// Six seed competencies (a0000001-…-0000000000NN exist from the framework seed),
// each paired with two normative item keys. Reverse items flip 6 - raw, so a
// high raw on a reverse item still reads as a high self-rating.
const COMPETENCIES = [
  "a0000001-0000-0000-0000-000000000001",
  "a0000001-0000-0000-0000-000000000005",
  "a0000001-0000-0000-0000-000000000011",
  "a0000001-0000-0000-0000-000000000017",
  "a0000001-0000-0000-0000-000000000019",
  "a0000001-0000-0000-0000-000000000024",
];

type DemoTaker = {
  name: string;
  emailLocal: string;
  purpose: "development" | "hiring";
  // raw_score (1-5) per competency for the two normative items: [item_a, item_b].
  // Second item of each pair is reverse-keyed (so a high raw reads as a strength).
  scores: [number, number][];
};

// Three completed sittings spanning the band range (a strong development read, a
// solid hiring read, and a mixed/developing profile) so the cohort distribution
// and the results table both read realistically.
const TAKERS: DemoTaker[] = [
  {
    name: "Hessa Al Suwaidi",
    emailLocal: "hessa.suwaidi",
    purpose: "development",
    scores: [
      [5, 5],
      [4, 5],
      [5, 4],
      [4, 4],
      [5, 5],
      [4, 5],
    ],
  },
  {
    name: "Khalid Al Otaibi",
    emailLocal: "khalid.otaibi",
    purpose: "hiring",
    scores: [
      [4, 4],
      [4, 3],
      [4, 4],
      [3, 4],
      [4, 4],
      [4, 3],
    ],
  },
  {
    name: "Maryam Al Balushi",
    emailLocal: "maryam.balushi",
    purpose: "development",
    scores: [
      [3, 3],
      [3, 2],
      [4, 3],
      [2, 3],
      [3, 4],
      [3, 2],
    ],
  },
];

async function seed(sb: DemoSb, org: DemoOrgIds): Promise<DemoSeedOutcome> {
  // Idempotent: skip if this org already has demo Persona sittings.
  const existing = await sb
    .from("behavioral_assessment_sessions")
    .select("id")
    .eq("organization_id", org.organizationId)
    .eq("status", "submitted")
    .is("candidate_id", null)
    .limit(1);
  if (existing.error) throw new Error(`Persona check: ${existing.error.message}`);
  if (existing.data && existing.data.length > 0) {
    return { service: SERVICE, label: LABEL, created: 0, note: "already present" };
  }

  // Optional: attach an existing role profile to the hiring sitting so the
  // results page can render a target role + fit %. Best-effort - the column is
  // ON DELETE SET NULL and neither screen requires it.
  let roleProfileId: string | null = null;
  try {
    const rp = await sb.from("role_profiles").select("id").order("name_en").limit(1).maybeSingle();
    roleProfileId = (rp.data?.id as string | undefined) ?? null;
  } catch {
    /* role_profiles may be absent - skip the role binding */
  }

  let created = 0;
  for (let t = 0; t < TAKERS.length; t++) {
    const taker = TAKERS[t];
    const submittedAt = daysAgo(2 + t);
    const startedAt = daysAgo(3 + t);

    const sessionRow: Record<string, unknown> = {
      organization_id: org.organizationId,
      taker_name: taker.name,
      taker_email: `${taker.emailLocal}@${DEMO_EMAIL_DOMAIN}`,
      status: "submitted",
      purpose: taker.purpose,
      item_format: "both",
      started_at: startedAt,
      submitted_at: submittedAt,
      ...(taker.purpose === "hiring" && roleProfileId
        ? { target_role_profile_id: roleProfileId }
        : {}),
    };

    const ses = await sb
      .from("behavioral_assessment_sessions")
      .insert(sessionRow)
      .select("id")
      .single();
    if (ses.error || !ses.data) throw new Error(`Persona session: ${ses.error?.message}`);
    const sessionId = ses.data.id as string;

    // Two normative items per competency (item_b reverse-keyed).
    const responses = COMPETENCIES.flatMap((cid, ci) => {
      const [rawA, rawB] = taker.scores[ci];
      return [
        {
          session_id: sessionId,
          competency_id: cid,
          item_key: `demo-c${ci + 1}-i1`,
          raw_score: rawA,
          is_reverse: false,
          item_type: "normative",
          answered_at: submittedAt,
        },
        {
          session_id: sessionId,
          competency_id: cid,
          item_key: `demo-c${ci + 1}-i2`,
          // Reverse item: store 6 - intended so the reverse mapping yields the
          // intended self-rating (keeps the per-competency mean clean).
          raw_score: 6 - rawB,
          is_reverse: true,
          item_type: "normative",
          answered_at: submittedAt,
        },
      ];
    });

    const resp = await sb.from("behavioral_assessment_responses").insert(responses);
    if (resp.error) throw new Error(`Persona responses: ${resp.error.message}`);
    created++;
  }

  return {
    service: SERVICE,
    label: LABEL,
    created,
    note: `${created} completed self-assessment sittings (development + hiring)`,
  };
}

async function purge(sb: DemoSb, org: DemoOrgIds): Promise<string> {
  // Find this org's standalone Persona sessions, delete their responses
  // (children) first, then the sessions. Scoped to the demo org only.
  const ses = await sb
    .from("behavioral_assessment_sessions")
    .select("id")
    .eq("organization_id", org.organizationId)
    .is("candidate_id", null);
  if (ses.error) throw new Error(ses.error.message);
  const sessionIds = ((ses.data ?? []) as { id: string }[]).map((r) => r.id);
  if (sessionIds.length === 0) return "no Persona sittings";

  await sb.from("behavioral_assessment_responses").delete().in("session_id", sessionIds);
  const del = await sb.from("behavioral_assessment_sessions").delete().in("id", sessionIds);
  if (del.error) throw new Error(del.error.message);
  return `Persona sittings removed (${sessionIds.length})`;
}

async function count(sb: DemoSb, org: DemoOrgIds): Promise<DemoServiceCount | null> {
  try {
    const res = await sb
      .from("behavioral_assessment_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId)
      .eq("status", "submitted")
      .is("candidate_id", null);
    if (res.error) return null; // table absent (un-applied migration) -> tolerant
    return { service: SERVICE, label: LABEL, count: res.count ?? 0 };
  } catch {
    return null;
  }
}

const personaModule: DemoServiceModule = { id: SERVICE, label: LABEL, seed, purge, count };

export default personaModule;
