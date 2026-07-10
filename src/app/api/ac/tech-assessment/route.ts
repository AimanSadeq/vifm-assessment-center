/**
 * Technical Competency Assessment API.
 *
 * POST { action: "start", domainKey }
 *   -> { session_id, test }   (test is answer-key STRIPPED; full test held
 *      server-side in tech_assessment_sessions)
 * POST { action: "score", sessionId, answers, takerName?, takerEmail?, ... }
 *   -> TechResult            (server reloads the stored test and grades it)
 *
 * Two assembly modes:
 *   • CERTIFIED - assembled entirely from SME-approved bank items (Tier 2).
 *     When the result clears the domain's documented cut-score, a
 *     'technical_proficiency' credential is issued. This is the defensible,
 *     sellable path.
 *   • INDICATIVE - live AI-authored items (no human review). Renders a 1–5
 *     band but NEVER issues a credential. The honest fallback when a domain's
 *     approved bank is too thin to certify (or ANTHROPIC_API_KEY is absent).
 *
 * Integrity: the answer key never reaches the browser; sessions are single-use
 * (a consumed session can't be re-scored, so a passing certified sitting can't
 * be replayed for extra credentials). If tech_assessment_* tables aren't
 * migrated yet, both actions fall back to the legacy client-graded path.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateTechnicalAssessment,
  generateFunctionAssessment,
  scoreTechnicalAssessment,
  itemIsCorrect,
  stripAnswerKey,
  TechGenerationError,
  type TechTest,
  type TechItem,
} from "@/lib/ai/technical-assessment";
import { techDomainByKey, type TechDomainKey } from "@/lib/competencies/technical-framework";
import { getTechnicalFunctionByRef } from "@/lib/competencies/technical-function";
import {
  buildCertifiedTest,
  buildReviewTest,
  getCutScore,
  recordItemAdministration,
} from "@/lib/competencies/technical-item-bank";
import { buildCertifiedFunctionTest, getFunctionCutScore } from "@/lib/competencies/technical-function-bank";
import { issueCredential } from "@/lib/credentials/issue";
import { getTimerMinutes } from "@/lib/assessment-timers";

export const dynamic = "force-dynamic";

/** Per-instance time limit (seconds) for a technical run, or null = no limit.
 *  Domain/function read their own scope; a mix sums the contributing functions'
 *  limits (capped), per the agreed mix-and-match rule. */
async function techTimeLimitSeconds(scopes: string[], { sum }: { sum: boolean }): Promise<number | null> {
  if (scopes.length === 0) return null;
  if (!sum) {
    const m = await getTimerMinutes(scopes[0], null);
    return m == null ? null : m * 60;
  }
  let total = 0;
  let any = false;
  for (const s of scopes) {
    const m = await getTimerMinutes(s, null);
    if (m != null) { total += m; any = true; }
  }
  return any ? Math.min(180, total) * 60 : null;
}

// A session stores the full test PLUS the bank item ids it drew (so a certified
// sitting can post administration stats back to the bank on scoring) and, for a
// function run, the function binding (its key/id - domain_key no longer applies).
type StoredTest = TechTest & {
  item_ids?: string[];
  function_key?: string | null;
  function_id?: string | null;
  /** Server-side deadline (stamped at session creation) for the time-limit
   *  backstop. Held server-side in the session; never trusted from the client. */
  deadline_at?: string | null;
};

type Body = {
  action?: "start" | "score";
  domainKey?: string;
  functionKey?: string; // a function ref (standard key or custom id) for a function run
  functionKeys?: string[]; // 2+ refs → a combined (mix & match) run over the merged blueprints
  skills?: string[]; // optional skill selection (canonical English names) filtering the merged blueprint
  sessionId?: string;
  items?: TechItem[]; // legacy client-graded path only
  domainName?: string;
  aiGenerated?: boolean;
  answers?: Record<string, number | number[]>;
  takerName?: string | null;
  takerEmail?: string | null;
  candidateId?: string | null;
  engagementId?: string | null;
  programId?: string | null;
  participantId?: string | null;
  language?: "en" | "ar";
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 3;

// Backstop grace for the server-side time-limit check. The client countdown
// auto-submits at the deadline; this server check only rejects grossly late
// submissions from a manipulated client. The deadline is stamped at session
// creation (just before the brief instructions screen), so a generous grace
// absorbs instructions-reading + network latency + clock skew and never rejects
// a legitimate on-time taker - it only stops gross abuse (submitting long after).
const TIMER_GRACE_MS = 1000 * 60 * 5;

/** Has this program participant already completed a sitting for the given scope?
 *  Enforces one certified sitting per program seat (no retake-farming / duplicate
 *  credentials off one token). Tolerant: false if the columns are absent. */
async function participantHasResultForScope(
  participantId: string,
  scope: { functionKey?: string | null; domainKey?: string | null }
): Promise<boolean> {
  try {
    const sb = createServiceClient();
    let q = sb.from("tech_assessment_results").select("id").eq("participant_id", participantId).limit(1);
    if (scope.functionKey) q = q.eq("function_key", scope.functionKey);
    else if (scope.domainKey) q = q.eq("domain_key", scope.domainKey);
    const { data, error } = await q;
    if (error) return false;
    return !!(data && data.length > 0);
  } catch {
    return false;
  }
}

// The self-answering placeholder deck exists so the dev flow renders without an
// API key - it must never be administered in production.
const isPlaceholderTest = (t: TechTest) => !t.certified && !t.ai_generated;

const generationFailedResponse = () =>
  NextResponse.json(
    { error: "The assessment couldn't be generated right now. Please try again." },
    { status: 503 }
  );

const engineNotConfiguredResponse = () =>
  NextResponse.json(
    { error: "The assessment engine is not configured on this server." },
    { status: 503 }
  );

// The legacy client-graded fallback (sending the FULL test incl. answer key to
// the browser when no session row could be created) is a CRITICAL key leak - a
// taker could read correct_index/correct_indices straight from the start
// payload and the score path would trust client-posted items. Every migrated
// environment has tech_assessment_sessions, so a session is always created; if
// the insert genuinely fails we refuse the run rather than downgrade to the
// key-leaking path.
const sessionUnavailableResponse = () =>
  NextResponse.json(
    { error: "The assessment store is unavailable right now. Please try again shortly." },
    { status: 503 }
  );

async function createSession(
  test: StoredTest,
  meta: { candidateId: string | null; engagementId: string | null; language: "en" | "ar" },
  fn: { key: string | null; id: string | null } = { key: null, id: null }
): Promise<string | null> {
  try {
    const sb = createServiceClient();
    // For a function run, domain_key no longer applies (the test spans several
    // domains' skills) - store NULL there + the function binding instead. For a
    // domain run we omit the function columns entirely, so the insert is byte-for-
    // byte the legacy shape and keeps working before 00058 is applied.
    const row: Record<string, unknown> = {
      domain_key: fn.key ? null : test.domain_key,
      ui_language: meta.language,
      test,
      candidate_id: meta.candidateId,
      engagement_id: meta.engagementId,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
    if (fn.key) {
      row.function_key = fn.key;
      row.function_id = fn.id;
    }
    const { data, error } = await sb
      .from("tech_assessment_sessions")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

type LoadedSession = { test: StoredTest; candidateId: string | null; engagementId: string | null };

async function loadSession(id: string): Promise<LoadedSession | null> {
  try {
    const sb = createServiceClient();
    const nowIso = new Date().toISOString();
    // ATOMIC single-use claim: flip consumed_at null->now in ONE statement and
    // only proceed if this call won the row (RETURNING). The previous
    // SELECT-then-UPDATE let two concurrent /score calls both pass the
    // unconsumed check, both score, and both issue a CREDENTIAL (replay). The
    // WHERE also excludes expired sessions so the TTL is enforced in the same
    // atomic step. No row back => already consumed or expired => reject.
    const { data, error } = await sb
      .from("tech_assessment_sessions")
      .update({ consumed_at: nowIso })
      .eq("id", id)
      .is("consumed_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .select("test, candidate_id, engagement_id")
      .maybeSingle();
    if (error || !data || !data.test) return null;
    return {
      test: data.test as StoredTest,
      candidateId: (data.candidate_id as string | null) ?? null,
      engagementId: (data.engagement_id as string | null) ?? null,
    };
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
  let functionRef = body.functionKey?.trim() || null;
  const language: "en" | "ar" = body.language === "ar" ? "ar" : "en";

  if (body.action === "start") {
    const candidateId = body.candidateId?.trim() || null;
    const engagementId = body.engagementId?.trim() || null;

    // ── Combined (mix & match) run: skills picked ad hoc in the runner across
    //    one or more functions - the selection (or the full merged blueprints
    //    when none given) becomes ONE sitting. Nothing is persisted. ──
    const mixRefs = Array.isArray(body.functionKeys)
      ? Array.from(new Set(body.functionKeys.map((r) => String(r).trim()).filter(Boolean)))
      : [];
    const pickedSkills = Array.isArray(body.skills)
      ? Array.from(new Set(body.skills.map((s) => String(s).trim()).filter(Boolean)))
      : [];
    if (mixRefs.length === 1 && pickedSkills.length === 0 && !functionRef) functionRef = mixRefs[0];
    if (mixRefs.length >= 2 || (mixRefs.length >= 1 && pickedSkills.length > 0)) {
      const fns = (await Promise.all(mixRefs.map((r) => getTechnicalFunctionByRef(r, language)))).filter(
        (f): f is NonNullable<typeof f> => f != null
      );
      if (fns.length === 0) {
        return NextResponse.json({ error: "valid functionKeys required" }, { status: 400 });
      }
      // Merge the blueprints (deduped), then narrow to the picked skills - only
      // canonical blueprint skills are accepted (the selection can't inject
      // arbitrary strings into assembly/generation).
      let skillsEn = Array.from(new Set(fns.flatMap((f) => f.skillsEn)));
      if (pickedSkills.length > 0) {
        const allowed = new Set(skillsEn);
        skillsEn = pickedSkills.filter((s) => allowed.has(s));
        if (skillsEn.length === 0) {
          return NextResponse.json({ error: "no valid skills selected" }, { status: 400 });
        }
      }
      const pickedSet = new Set(skillsEn);
      const contributing = fns.filter((f) => f.skillsEn.some((s) => pickedSet.has(s)));
      const functionName = (contributing.length > 0 ? contributing : fns).map((f) => f.name).join(" + ");
      const compositeKey = `mix:${(contributing.length > 0 ? contributing : fns).map((f) => f.ref).join("+")}`;
      // Scale the per-skill draw down as the merged blueprint grows, so a
      // combined sitting stays a sane length (~24 items).
      const perSkill = Math.max(2, Math.min(4, Math.floor(24 / Math.max(1, skillsEn.length))));
      // Certified when EVERY merged skill clears the approved floor (item banks
      // are keyed by skill, so each function's pool is reused); else indicative.
      const certified = await buildCertifiedFunctionTest({
        functionKey: compositeKey,
        functionName,
        skillsEn,
        functionId: null,
        drawPerSkill: perSkill,
        language,
      });
      let stored: StoredTest;
      if (certified) {
        stored = { ...certified.test, item_ids: certified.itemIds, function_key: compositeKey, function_id: null };
      } else {
        // Mirror the function/domain paths: a generation failure (e.g. no
        // ANTHROPIC_API_KEY and no approved bank to fall back on) returns a clean
        // 503 instead of an unhandled 500.
        try {
          stored = {
            ...(await generateFunctionAssessment({
              functionKey: compositeKey,
              functionName,
              skillsEn,
              language,
              itemsPerSkill: perSkill,
            })),
            function_key: compositeKey,
            function_id: null,
          };
        } catch (err) {
          if (err instanceof TechGenerationError) {
            console.error("[tech-assessment] mix start failed:", err.message);
            return generationFailedResponse();
          }
          throw err;
        }
      }
      if (process.env.NODE_ENV === "production" && isPlaceholderTest(stored)) {
        return engineNotConfiguredResponse();
      }
      const time_limit_seconds = await techTimeLimitSeconds(
        (contributing.length > 0 ? contributing : fns).map((f) => `tech_function:${f.ref}`),
        { sum: true }
      );
      if (time_limit_seconds && time_limit_seconds > 0) {
        stored.deadline_at = new Date(Date.now() + time_limit_seconds * 1000 + TIMER_GRACE_MS).toISOString();
      }
      const session_id = await createSession(
        stored,
        { candidateId, engagementId, language },
        { key: compositeKey, id: null }
      );
      if (session_id) {
        return NextResponse.json({ session_id, test: stripAnswerKey(stored), time_limit_seconds });
      }
      // No session row could be created - refuse rather than leak the answer key.
      return sessionUnavailableResponse();
    }

    // ── Function run: a DEEP, multi-skill blueprinted assessment (the job-level
    //    unit). Always indicative (no certified function bank yet). ──
    if (functionRef) {
      const fn = await getTechnicalFunctionByRef(functionRef, language);
      if (!fn) return NextResponse.json({ error: "valid functionKey required" }, { status: 400 });
      // One certified sitting per program seat: if this participant already has a
      // result on this function, refuse a retake - stops attempt-farming and
      // duplicate credentials off one token. The score path re-validates the
      // participant->program binding before attributing/issuing.
      const partId = body.participantId?.trim() || null;
      if (partId && (await participantHasResultForScope(partId, { functionKey: fn.ref }))) {
        return NextResponse.json({ error: "already_completed" }, { status: 409 });
      }
      // Prefer the certified path (SME-approved per-skill bank). Fall back to the
      // indicative AI assembly when any skill is below its coverage floor.
      const certified = await buildCertifiedFunctionTest({
        functionKey: fn.ref,
        functionName: fn.name,
        skillsEn: fn.skillsEn,
        functionId: fn.id,
        language,
      });
      let stored: StoredTest;
      if (certified) {
        stored = { ...certified.test, item_ids: certified.itemIds, function_key: fn.ref, function_id: fn.id };
      } else {
        try {
          stored = {
            ...(await generateFunctionAssessment({
              functionKey: fn.ref,
              functionName: fn.name,
              skillsEn: fn.skillsEn,
              language,
            })),
            function_key: fn.ref,
            function_id: fn.id,
          };
        } catch (err) {
          if (err instanceof TechGenerationError) {
            console.error("[tech-assessment] function start failed:", err.message);
            return generationFailedResponse();
          }
          throw err;
        }
      }
      if (process.env.NODE_ENV === "production" && isPlaceholderTest(stored)) {
        return engineNotConfiguredResponse();
      }
      const time_limit_seconds = await techTimeLimitSeconds([`tech_function:${fn.ref}`], { sum: false });
      if (time_limit_seconds && time_limit_seconds > 0) {
        stored.deadline_at = new Date(Date.now() + time_limit_seconds * 1000 + TIMER_GRACE_MS).toISOString();
      }
      const session_id = await createSession(
        stored,
        { candidateId, engagementId, language },
        { key: fn.ref, id: fn.id }
      );
      if (session_id) {
        return NextResponse.json({ session_id, test: stripAnswerKey(stored), time_limit_seconds });
      }
      // No session row could be created - refuse rather than leak the answer key.
      return sessionUnavailableResponse();
    }

    // ── Domain run (legacy path): 8 generic items, certified when the bank allows. ──
    if (!domainKey || !techDomainByKey(domainKey)) {
      return NextResponse.json({ error: "valid domainKey or functionKey required" }, { status: 400 });
    }
    // One sitting per program seat (see the function branch).
    const partIdDomain = body.participantId?.trim() || null;
    if (partIdDomain && (await participantHasResultForScope(partIdDomain, { domainKey }))) {
      return NextResponse.json({ error: "already_completed" }, { status: 409 });
    }

    // Serving order (no live-AI at deal time when a bank exists):
    //   1. Certified - assembled from SME-APPROVED items → issues a credential.
    //   2. In-review - the fixed, seeded bank (approved OR in_review) served to
    //      every candidate, flagged provisional (no credential). This replaces the
    //      old live-AI fallback: same authored questions, not freshly generated.
    //   3. Live-AI - only if the domain has NO authored items at all (empty bank).
    const certified = await buildCertifiedTest(domainKey, undefined, language);
    let stored: StoredTest;
    if (certified) {
      stored = { ...certified.test, item_ids: certified.itemIds };
    } else {
      const reviewBank = await buildReviewTest(domainKey, undefined, language);
      if (reviewBank) {
        stored = { ...reviewBank.test, item_ids: reviewBank.itemIds };
      } else {
        try {
          stored = await generateTechnicalAssessment({ domainKey, language });
        } catch (err) {
          if (err instanceof TechGenerationError) {
            console.error("[tech-assessment] domain start failed:", err.message);
            return generationFailedResponse();
          }
          throw err;
        }
      }
    }
    if (process.env.NODE_ENV === "production" && isPlaceholderTest(stored)) {
      return engineNotConfiguredResponse();
    }

    const time_limit_seconds = await techTimeLimitSeconds([`tech_domain:${domainKey}`], { sum: false });
    if (time_limit_seconds && time_limit_seconds > 0) {
      stored.deadline_at = new Date(Date.now() + time_limit_seconds * 1000 + TIMER_GRACE_MS).toISOString();
    }
    const session_id = await createSession(stored, { candidateId, engagementId, language });
    if (session_id) {
      return NextResponse.json({ session_id, test: stripAnswerKey(stored), time_limit_seconds });
    }
    // No session row could be created - refuse rather than leak the answer key.
    return sessionUnavailableResponse();
  }

  if (body.action === "score") {
    let test: StoredTest | null = null;
    // For a SESSION run, the candidate/engagement come from the session (bound at
    // start), never from the request body - a leaked session id must not let a
    // caller mint a credential under another identity.
    let sessionCandidateId: string | null = null;
    let sessionEngagementId: string | null = null;
    let fromSession = false;
    if (body.sessionId) {
      const loaded = await loadSession(body.sessionId);
      if (!loaded) return NextResponse.json({ error: "invalid or expired session" }, { status: 400 });
      test = loaded.test;
      sessionCandidateId = loaded.candidateId;
      sessionEngagementId = loaded.engagementId;
      fromSession = true;
      // Time-limit backstop: reject a grossly late submission from a manipulated
      // client. The client countdown auto-submits on time; the grace baked into
      // deadline_at absorbs reading + latency, so an on-time taker never trips
      // this. The session is already consumed (single-use) by loadSession.
      if (test.deadline_at && Date.now() > Date.parse(test.deadline_at)) {
        return NextResponse.json({ error: "time limit exceeded" }, { status: 400 });
      }
    } else if (Array.isArray(body.items) && domainKey) {
      const domain = techDomainByKey(domainKey);
      // Items posted from the client are inherently un-trusted → indicative only.
      test = {
        domain_key: domainKey,
        domain_name: body.domainName || domain?.name || domainKey,
        items: body.items,
        ai_generated: body.aiGenerated === true,
        certified: false,
      };
    }
    if (!test) {
      return NextResponse.json({ error: "a valid session (or items + domainKey) is required" }, { status: 400 });
    }

    const answers = body.answers ?? {};
    const result = scoreTechnicalAssessment({ test, answers });

    // A function run spans several domains' skills, so domain_key no longer
    // applies - the result is bound to the function instead (key + id).
    const isFunctionRun = !!test.function_key;

    const takerName = body.takerName?.trim() || null;
    const takerEmail = body.takerEmail?.trim() || null;
    // Session run -> the session's bound identity (credential-integrity); items
    // run is untrusted + indicative-only, so the body is acceptable there.
    const candidateId = fromSession ? sessionCandidateId : (body.candidateId?.trim() || null);
    const engagementId = fromSession ? sessionEngagementId : (body.engagementId?.trim() || null);

    // ── Certification gate: only a certified run that clears the cut-score
    //    earns a technical_proficiency credential. ──
    let passedCut: boolean | null = null;
    let cutPct: number | null = null;
    let credentialCode: string | null = null;

    if (result.certified) {
      // A certified FUNCTION run uses its per-function standard; a certified
      // DOMAIN run uses the domain cut-score (domain_key is a real TechDomainKey).
      const passPct = isFunctionRun
        ? (await getFunctionCutScore(test.function_id ?? null)).passPct
        : (await getCutScore(result.domain_key as TechDomainKey)).passPct;
      cutPct = passPct;
      passedCut = result.pct >= passPct;

      // Feed light p-value substrate back to the bank (best-effort).
      if (test.item_ids && test.item_ids.length > 0) {
        const correctById: Record<string, boolean> = {};
        for (const item of test.items) {
          correctById[item.id] = itemIsCorrect(item, answers[item.id]);
        }
        await recordItemAdministration(test.item_ids, correctById);
      }
    }

    // Persist the result first (best-effort; table exists only after 00052),
    // capturing its id so the credential can key off it (idempotent source).
    let resultId: string | null = null;
    try {
      const sb = createServiceClient();
      // Function run: NULL domain_key + the function binding (00058 columns).
      // Domain run: domain_key as before, no function columns (pre-00058 safe).
      const functionCols = isFunctionRun
        ? { function_key: test.function_key ?? null, function_id: test.function_id ?? null }
        : {};
      const legacy = {
        taker_name: takerName,
        taker_email: takerEmail,
        domain_key: isFunctionRun ? null : result.domain_key,
        ui_language: language,
        score_correct: result.correct,
        score_total: result.total,
        score_pct: result.pct,
        level: result.proficiency.level,
        level_label: result.proficiency.label,
        result,
        ai_generated: result.ai_generated,
        candidate_id: candidateId,
        engagement_id: engagementId,
        ...functionCols,
      };
      // Full insert (incl. the 00053 certification columns). If those columns
      // aren't there yet, retry with the legacy set so indicative results still
      // persist before the migration is applied.
      const full = await sb
        .from("tech_assessment_results")
        .insert({ ...legacy, certified: result.certified, passed_cut: passedCut, cut_pct: cutPct })
        .select("id")
        .single();
      if (full.error) {
        const fallback = await sb.from("tech_assessment_results").insert(legacy).select("id").single();
        resultId = (fallback.data?.id as string | undefined) ?? null;
      } else {
        resultId = (full.data?.id as string | undefined) ?? null;
      }
    } catch {
      /* table not migrated / older schema - return the result anyway */
    }

    // Bind the result to a standalone certification-program participant (00057).
    // Decoupled from the insert above so it's tolerant of those columns being absent.
    const programId = body.programId?.trim() || null;
    const participantId = body.participantId?.trim() || null;
    // Hoisted so the credential path can dedupe per participant+scope.
    let boundProgramId: string | null = null;
    let boundParticipantId: string | null = null;
    if (resultId && (programId || participantId)) {
      try {
        const sb = createServiceClient();
        // Validate the pairing before attributing the result. A leaked or
        // guessed program/participant id must not let a caller bind a foreign
        // score onto another program's roster: require the participant to exist
        // AND (when a program is also named) to belong to it, resolving the
        // bound program from the participant's own row. On any mismatch we leave
        // the result unbound rather than mis-attribute it.
        if (participantId) {
          const { data: part } = await sb
            .from("technical_program_participants")
            .select("id, program_id")
            .eq("id", participantId)
            .maybeSingle();
          if (part && (!programId || programId === part.program_id)) {
            boundParticipantId = part.id as string;
            boundProgramId = part.program_id as string;
          }
        } else if (programId) {
          const { data: prog } = await sb
            .from("technical_programs")
            .select("id")
            .eq("id", programId)
            .maybeSingle();
          if (prog) boundProgramId = prog.id as string;
        }
        if (boundProgramId || boundParticipantId) {
          await sb
            .from("tech_assessment_results")
            .update({ program_id: boundProgramId, participant_id: boundParticipantId })
            .eq("id", resultId);
        }
      } catch {
        /* 00057 columns absent - non-fatal */
      }
    }

    // Issue the credential when the certified run passed the cut-score.
    if (result.certified && passedCut) {
      // Credential dedupe: a program participant must not farm multiple verifiable
      // credentials by retaking. If this participant already holds a passing
      // certified result WITH a credential for the same scope from an EARLIER run,
      // surface that credential instead of minting a second one. (The start path
      // already refuses a retake; this is the defence-in-depth at issuance.)
      if (boundParticipantId && resultId) {
        try {
          const sb = createServiceClient();
          const scopeCol = isFunctionRun ? "function_key" : "domain_key";
          const scopeVal = isFunctionRun ? (test.function_key ?? null) : result.domain_key;
          let pq = sb
            .from("tech_assessment_results")
            .select("credential_code")
            .eq("participant_id", boundParticipantId)
            .eq("certified", true)
            .eq("passed_cut", true)
            .neq("id", resultId)
            .not("credential_code", "is", null)
            .limit(1);
          if (scopeVal) pq = pq.eq(scopeCol, scopeVal);
          const { data: prior } = await pq;
          if (prior && prior.length > 0) {
            credentialCode = (prior[0].credential_code as string | null) ?? null;
          }
        } catch {
          /* certified/passed_cut columns absent (pre-00053) - fall through to issue */
        }
      }
    }
    if (result.certified && passedCut && !credentialCode) {
      // Credential identity: for a BOUND run the name/email MUST come from the
      // authoritative server record - the candidate row for a candidate-bound run,
      // the program-participant row for a program run - never from the taker-typed
      // body, or a taker could POST an arbitrary name and mint a verifiable
      // credential under it. Taker-supplied identity is honoured ONLY on the truly
      // anonymous/unbound path (no candidate AND no participant), where there is no
      // record of record to trust.
      const isBound = !!candidateId || !!boundParticipantId;
      let issuedToName: string | null = isBound ? null : takerName;
      let issuedToEmail: string | null = isBound ? null : takerEmail;
      if (candidateId) {
        try {
          const sb = createServiceClient();
          const { data: cand } = await sb
            .from("candidates")
            .select("full_name, email")
            .eq("id", candidateId)
            .maybeSingle<{ full_name: string | null; email: string | null }>();
          issuedToName = cand?.full_name ?? null;
          issuedToEmail = cand?.email ?? null;
        } catch {
          /* ignore - fall back to the safe defaults below */
        }
      } else if (boundParticipantId) {
        try {
          const sb = createServiceClient();
          const { data: part } = await sb
            .from("technical_program_participants")
            .select("full_name, email")
            .eq("id", boundParticipantId)
            .maybeSingle<{ full_name: string | null; email: string | null }>();
          issuedToName = part?.full_name ?? null;
          issuedToEmail = part?.email ?? null;
        } catch {
          /* ignore - fall back to the safe defaults below */
        }
      }
      const issued = await issueCredential({
        candidateId,
        issuedToName: issuedToName ?? "VIFM Candidate",
        issuedToEmail,
        type: "technical_proficiency",
        titleEn: `VIFM Technical Proficiency - ${result.domain_name}`,
        subtitleEn: `${result.proficiency.label} (Level ${result.proficiency.level}/5)`,
        scorePct: result.pct,
        sourceId: resultId,
        metadata: {
          ...(isFunctionRun ? { function_key: result.domain_key } : { domain_key: result.domain_key }),
          level: result.proficiency.level,
          cut_pct: cutPct,
          certified: true,
        },
      });
      credentialCode = issued?.verificationCode ?? null;

      // Back-link the credential onto the result row.
      if (credentialCode && resultId) {
        try {
          const sb = createServiceClient();
          await sb.from("tech_assessment_results").update({ credential_code: credentialCode }).eq("id", resultId);
        } catch {
          /* best-effort */
        }
      }
    }

    return NextResponse.json({
      ...result,
      passedCut,
      cutPct,
      credentialCode,
    });
  }

  return NextResponse.json({ error: "action must be 'start' or 'score'" }, { status: 400 });
}
