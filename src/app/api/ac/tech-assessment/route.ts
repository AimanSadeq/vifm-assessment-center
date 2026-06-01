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
 *   • CERTIFIED — assembled entirely from SME-approved bank items (Tier 2).
 *     When the result clears the domain's documented cut-score, a
 *     'technical_proficiency' credential is issued. This is the defensible,
 *     sellable path.
 *   • INDICATIVE — live AI-authored items (no human review). Renders a 1–5
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
  stripAnswerKey,
  type TechTest,
  type TechItem,
} from "@/lib/ai/technical-assessment";
import { techDomainByKey, type TechDomainKey } from "@/lib/competencies/technical-framework";
import { getTechnicalFunctionByRef } from "@/lib/competencies/technical-function";
import {
  buildCertifiedTest,
  getCutScore,
  recordItemAdministration,
} from "@/lib/competencies/technical-item-bank";
import { issueCredential } from "@/lib/credentials/issue";

export const dynamic = "force-dynamic";

// A session stores the full test PLUS the bank item ids it drew (so a certified
// sitting can post administration stats back to the bank on scoring) and, for a
// function run, the function binding (its key/id — domain_key no longer applies).
type StoredTest = TechTest & {
  item_ids?: string[];
  function_key?: string | null;
  function_id?: string | null;
};

type Body = {
  action?: "start" | "score";
  domainKey?: string;
  functionKey?: string; // a function ref (standard key or custom id) for a function run
  sessionId?: string;
  items?: TechItem[]; // legacy client-graded path only
  domainName?: string;
  aiGenerated?: boolean;
  answers?: Record<string, number>;
  takerName?: string | null;
  takerEmail?: string | null;
  candidateId?: string | null;
  engagementId?: string | null;
  programId?: string | null;
  participantId?: string | null;
  language?: "en" | "ar";
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 3;

async function createSession(
  test: StoredTest,
  meta: { candidateId: string | null; engagementId: string | null; language: "en" | "ar" },
  fn: { key: string | null; id: string | null } = { key: null, id: null }
): Promise<string | null> {
  try {
    const sb = createServiceClient();
    // For a function run, domain_key no longer applies (the test spans several
    // domains' skills) — store NULL there + the function binding instead. For a
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

async function loadSession(id: string): Promise<StoredTest | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("tech_assessment_sessions")
      .select("test, expires_at, consumed_at")
      .eq("id", id)
      .single();
    if (error || !data || !data.test) return null;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
    // Single-use: a consumed session can't be re-scored (no credential replay).
    if (data.consumed_at) return null;
    try {
      await sb.from("tech_assessment_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", id);
    } catch {
      /* ignore */
    }
    return data.test as StoredTest;
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
  const functionRef = body.functionKey?.trim() || null;
  const language: "en" | "ar" = body.language === "ar" ? "ar" : "en";

  if (body.action === "start") {
    const candidateId = body.candidateId?.trim() || null;
    const engagementId = body.engagementId?.trim() || null;

    // ── Function run: a DEEP, multi-skill blueprinted assessment (the job-level
    //    unit). Always indicative (no certified function bank yet). ──
    if (functionRef) {
      const fn = await getTechnicalFunctionByRef(functionRef, language);
      if (!fn) return NextResponse.json({ error: "valid functionKey required" }, { status: 400 });
      const generated = await generateFunctionAssessment({
        functionKey: fn.ref,
        functionName: fn.name,
        skillsEn: fn.skillsEn,
        language,
      });
      const stored: StoredTest = { ...generated, function_key: fn.ref, function_id: fn.id };
      const session_id = await createSession(
        stored,
        { candidateId, engagementId, language },
        { key: fn.ref, id: fn.id }
      );
      if (session_id) {
        return NextResponse.json({ session_id, test: stripAnswerKey(stored) });
      }
      // Legacy (sessions/00058 not migrated): full test client-side, indicative only.
      return NextResponse.json({ ...stored });
    }

    // ── Domain run (legacy path): 8 generic items, certified when the bank allows. ──
    if (!domainKey || !techDomainByKey(domainKey)) {
      return NextResponse.json({ error: "valid domainKey or functionKey required" }, { status: 400 });
    }

    // Prefer the certified path (SME-approved bank). Fall back to indicative AI.
    const certified = await buildCertifiedTest(domainKey, undefined, language);
    const stored: StoredTest = certified
      ? { ...certified.test, item_ids: certified.itemIds }
      : await generateTechnicalAssessment({ domainKey, language });

    const session_id = await createSession(stored, { candidateId, engagementId, language });
    if (session_id) {
      return NextResponse.json({ session_id, test: stripAnswerKey(stored) });
    }
    // Legacy (sessions table not migrated): full test client-side, indicative only.
    return NextResponse.json({ ...stored });
  }

  if (body.action === "score") {
    let test: StoredTest | null = null;
    if (body.sessionId) {
      test = await loadSession(body.sessionId);
      if (!test) return NextResponse.json({ error: "invalid or expired session" }, { status: 400 });
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
    // applies — the result is bound to the function instead (key + id).
    const isFunctionRun = !!test.function_key;

    const takerName = body.takerName?.trim() || null;
    const takerEmail = body.takerEmail?.trim() || null;
    const candidateId = body.candidateId?.trim() || null;
    const engagementId = body.engagementId?.trim() || null;

    // ── Certification gate: only a certified run that clears the cut-score
    //    earns a technical_proficiency credential. ──
    let passedCut: boolean | null = null;
    let cutPct: number | null = null;
    let credentialCode: string | null = null;

    if (result.certified) {
      // Certified runs are always domain runs, so domain_key is a real TechDomainKey.
      const cut = await getCutScore(result.domain_key as TechDomainKey);
      cutPct = cut.passPct;
      passedCut = result.pct >= cut.passPct;

      // Feed light p-value substrate back to the bank (best-effort).
      if (test.item_ids && test.item_ids.length > 0) {
        const correctById: Record<string, boolean> = {};
        for (const item of test.items) {
          correctById[item.id] = answers[item.id] === item.correct_index;
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
      /* table not migrated / older schema — return the result anyway */
    }

    // Bind the result to a standalone certification-program participant (00057).
    // Decoupled from the insert above so it's tolerant of those columns being absent.
    const programId = body.programId?.trim() || null;
    const participantId = body.participantId?.trim() || null;
    if (resultId && (programId || participantId)) {
      try {
        const sb = createServiceClient();
        await sb
          .from("tech_assessment_results")
          .update({ program_id: programId, participant_id: participantId })
          .eq("id", resultId);
      } catch {
        /* 00057 columns absent — non-fatal */
      }
    }

    // Issue the credential when the certified run passed the cut-score.
    if (result.certified && passedCut) {
      let issuedToName = takerName;
      if (!issuedToName && candidateId) {
        try {
          const sb = createServiceClient();
          const { data: cand } = await sb
            .from("candidates")
            .select("full_name, email")
            .eq("id", candidateId)
            .maybeSingle();
          issuedToName = (cand?.full_name as string | undefined) ?? null;
          if (!takerEmail && cand?.email) body.takerEmail = cand.email as string;
        } catch {
          /* ignore */
        }
      }
      const issued = await issueCredential({
        candidateId,
        issuedToName: issuedToName ?? "VIFM Candidate",
        issuedToEmail: takerEmail ?? (body.takerEmail ?? null),
        type: "technical_proficiency",
        titleEn: `VIFM Technical Proficiency - ${result.domain_name}`,
        subtitleEn: `${result.proficiency.label} (Level ${result.proficiency.level}/5)`,
        scorePct: result.pct,
        sourceId: resultId,
        metadata: {
          domain_key: result.domain_key,
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
