// ─────────────────────────────────────────────────────────────
// Technical sandbox service (server-only). Bridges the 00077 schema to
// the validators/scoring. Loads blueprints, manages token-accessed
// sittings, autosaves work, and scores on submit.
//
// SECURITY: the public (candidate) blueprint NEVER includes
// master_solution or checkpoints — those stay server-side for scoring.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { scoreBlock, tierFor } from "./validators";
import { scoreSession, type BlockInput } from "./scoring";
import { runSqlCheckpoint, type SqlEngineConfig } from "./sql-runner";
import { buildMcqTestForFunction, gradeMcqTest, combineScores } from "./combined";
import { issueCredential } from "@/lib/credentials/issue";
import { scoreTechnicalAssessment, type TechTest } from "@/lib/ai/technical-assessment";
import type { Checkpoint, EngineType, SandboxWork } from "./types";

export interface PublicSkillBlock {
  id: string;
  pillarId: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  frameworkRef: string | null;
  engineType: EngineType;
  timeLimitSeconds: number;
  promptEn: string | null;
  promptAr: string | null;
  instructionsEn: string | null;
  instructionsAr: string | null;
  engineConfig: Record<string, unknown>;
  sortOrder: number;
}
export interface PublicPillar {
  id: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
  blocks: PublicSkillBlock[];
}
export interface PublicBlueprint {
  functionId: string;
  functionKey: string | null;
  nodeId: string | null;
  nameEn: string;
  nameAr: string | null;
  pillars: PublicPillar[];
}

// Internal (server) block carries the answer key for scoring.
interface ScoringBlock {
  id: string;
  pillarId: string;
  pillarNameEn: string;
  pillarNameAr: string | null;
  pillarSort: number;
  nameEn: string;
  nameAr: string | null;
  engineType: EngineType;
  engineConfig: Record<string, unknown>;
  masterSolution: Record<string, unknown>;
  checkpoints: Checkpoint[];
}

/**
 * True for Postgres "table/column does not exist" (undefined_table / undefined_column).
 * Lets callers degrade gracefully when a migration is pending instead of 500ing the
 * page - mirrors the rest of the codebase's "tolerant of migration not applied" pattern.
 */
export function isMissingSchemaError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703";
}

type PillarRow = {
  id: string; name_en: string; name_ar: string | null; sort_order: number;
  description_en?: string | null; description_ar?: string | null;
};

async function loadBlocks(functionId: string, selectedBlockIds?: string[] | null) {
  const sb = createServiceClient();
  // Prefer the wide select (with definition columns, migration 00118). If those
  // columns aren't applied yet, fall back to the base select so the report still
  // renders names-only instead of returning empty.
  let pillars: PillarRow[] = [];
  const wide = await sb
    .from("technical_pillars")
    .select("id, name_en, name_ar, sort_order, description_en, description_ar")
    .eq("function_id", functionId)
    .order("sort_order");
  if (wide.error) {
    if (!isMissingSchemaError(wide.error)) throw wide.error;
    const base = await sb
      .from("technical_pillars")
      .select("id, name_en, name_ar, sort_order")
      .eq("function_id", functionId)
      .order("sort_order");
    if (base.error) {
      if (isMissingSchemaError(base.error)) return { pillars: [], blocks: [] };
      throw base.error;
    }
    pillars = (base.data ?? []) as PillarRow[];
  } else {
    pillars = (wide.data ?? []) as PillarRow[];
  }
  const pillarIds = (pillars ?? []).map((p) => p.id);
  const { data: blocks, error: bErr } = await sb
    .from("technical_skill_blocks")
    .select("*")
    .in("pillar_id", pillarIds.length ? pillarIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "active")
    .order("sort_order");
  if (bErr) {
    if (isMissingSchemaError(bErr)) return { pillars: pillars ?? [], blocks: [] };
    throw bErr;
  }
  let outBlocks = blocks ?? [];
  // Custom sitting: restrict the hands-on section to the chosen blocks (then
  // drop pillars that end up with no blocks, so the report/runner don't show
  // empty categories). An EXPLICIT array (even empty) is an intentional narrow:
  // [] means a knowledge-only sitting (zero hands-on tasks). Only NULL/undefined
  // - i.e. a legacy/non-custom sitting that never set the column - means "all".
  if (Array.isArray(selectedBlockIds)) {
    const want = new Set(selectedBlockIds);
    outBlocks = outBlocks.filter((b) => want.has(b.id));
    const usedPillars = new Set(outBlocks.map((b) => b.pillar_id));
    pillars = (pillars ?? []).filter((p) => usedPillars.has(p.id));
  }
  return { pillars: pillars ?? [], blocks: outBlocks };
}

/** Public blueprint for the candidate runner (no answer key). */
export async function getPublicBlueprint(
  functionId: string,
  selectedBlockIds?: string[] | null,
): Promise<PublicBlueprint> {
  const sb = createServiceClient();
  const { data: fn, error } = await sb
    .from("technical_functions")
    .select("id, key, node_id, name_en, name_ar")
    .eq("id", functionId)
    .single();
  if (error) throw error;
  const { pillars, blocks } = await loadBlocks(functionId, selectedBlockIds);
  return {
    functionId: fn.id,
    functionKey: fn.key,
    nodeId: fn.node_id,
    nameEn: fn.name_en,
    nameAr: fn.name_ar,
    pillars: pillars.map((p) => ({
      id: p.id,
      nameEn: p.name_en,
      nameAr: p.name_ar,
      sortOrder: p.sort_order,
      blocks: blocks
        .filter((b) => b.pillar_id === p.id)
        .map((b) => ({
          id: b.id,
          pillarId: b.pillar_id,
          nameEn: b.name_en,
          nameAr: b.name_ar,
          descriptionEn: b.description_en,
          descriptionAr: b.description_ar,
          frameworkRef: b.framework_ref,
          engineType: b.engine_type as EngineType,
          timeLimitSeconds: b.time_limit_seconds,
          promptEn: b.prompt_en,
          promptAr: b.prompt_ar,
          instructionsEn: b.instructions_en,
          instructionsAr: b.instructions_ar,
          engineConfig: (b.engine_config ?? {}) as Record<string, unknown>,
          sortOrder: b.sort_order,
        })),
    })),
  };
}

async function loadScoringBlocks(
  functionId: string,
  selectedBlockIds?: string[] | null,
): Promise<ScoringBlock[]> {
  const { pillars, blocks } = await loadBlocks(functionId, selectedBlockIds);
  const pillarById = new Map(pillars.map((p) => [p.id, p]));
  return blocks.map((b) => {
    const p = pillarById.get(b.pillar_id)!;
    return {
      id: b.id,
      pillarId: b.pillar_id,
      pillarNameEn: p.name_en,
      pillarNameAr: p.name_ar,
      pillarSort: p.sort_order,
      nameEn: b.name_en,
      nameAr: b.name_ar,
      engineType: b.engine_type as EngineType,
      engineConfig: (b.engine_config ?? {}) as Record<string, unknown>,
      masterSolution: (b.master_solution ?? {}) as Record<string, unknown>,
      checkpoints: (b.checkpoints ?? []) as Checkpoint[],
    };
  });
}

export interface FunctionRow {
  id: string;
  key: string | null;
  nodeId: string | null;
  nameEn: string;
  nameAr: string | null;
  domainKey: string | null;
  nodeStatus: "active" | "inactive";
}

// ── Custom-builder picker data: a function's knowledge skills + hands-on tasks ──
export interface CustomBuilderBlock {
  id: string;
  nameEn: string;
  nameAr: string | null;
  engineType: EngineType;
  reviewStatus: string;
}
export interface CustomBuilderPillar {
  id: string;
  nameEn: string;
  blocks: CustomBuilderBlock[];
}
export interface CustomBuilderData {
  functionId: string;
  nodeId: string | null;
  nameEn: string;
  /** Knowledge (MCQ) skills declared on the function blueprint. */
  skills: string[];
  /** Hands-on tasks grouped by category (active blocks only). */
  pillars: CustomBuilderPillar[];
}

/** Skills + hands-on tasks for the pick-and-choose custom-assessment builder. */
export async function getCustomBuilderData(functionId: string): Promise<CustomBuilderData | null> {
  const sb = createServiceClient();
  const { data: fn, error } = await sb
    .from("technical_functions")
    .select("id, node_id, name_en, skills_en")
    .eq("id", functionId)
    .maybeSingle<{ id: string; node_id: string | null; name_en: string; skills_en: string[] | null }>();
  if (error || !fn) return null;

  // review_status is read tolerantly (00120). The picker shows it so the admin
  // knows a custom sitting on unapproved tasks is fine (it is indicative anyway).
  const { pillars, blocks } = await loadBlocks(functionId);
  const reviewById = new Map<string, string>();
  {
    const ids = blocks.map((b) => b.id);
    if (ids.length > 0) {
      const { data: rev } = await sb
        .from("technical_skill_blocks")
        .select("id, review_status")
        .in("id", ids);
      for (const r of (rev ?? []) as Array<{ id: string; review_status?: string }>) {
        reviewById.set(r.id, r.review_status ?? "draft");
      }
    }
  }

  return {
    functionId: fn.id,
    nodeId: fn.node_id,
    nameEn: fn.name_en,
    skills: (fn.skills_en ?? []).filter(Boolean),
    pillars: pillars.map((p) => ({
      id: p.id,
      nameEn: p.name_en,
      blocks: blocks
        .filter((b) => b.pillar_id === p.id)
        .map((b) => ({
          id: b.id,
          nameEn: b.name_en,
          nameAr: b.name_ar ?? null,
          engineType: b.engine_type as EngineType,
          reviewStatus: reviewById.get(b.id) ?? "draft",
        })),
    })),
  };
}

/** Node index for admin pickers. activeOnly = functions with seeded content. */
export async function listFunctions(activeOnly = false): Promise<FunctionRow[]> {
  const sb = createServiceClient();
  let q = sb
    .from("technical_functions")
    .select("id, key, node_id, name_en, name_ar, domain_key, node_status")
    .not("node_id", "is", null)
    .order("node_id");
  if (activeOnly) q = q.eq("node_status", "active");
  const { data, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((f) => ({
    id: f.id,
    key: f.key,
    nodeId: f.node_id,
    nameEn: f.name_en,
    nameAr: f.name_ar,
    domainKey: f.domain_key,
    nodeStatus: f.node_status,
  }));
}

/** Descriptors for the JD matcher (keywords + prose, all node functions). */
export async function listFunctionDescriptors() {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("technical_functions")
    .select("id, key, node_id, name_en, domain_key, keywords, descriptor_en, node_status")
    .not("node_id", "is", null);
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    key: f.key,
    nodeId: f.node_id,
    nameEn: f.name_en,
    domainKey: f.domain_key,
    keywords: (f.keywords ?? []) as string[],
    descriptor: f.descriptor_en as string | null,
    nodeStatus: f.node_status as "active" | "inactive",
  }));
}

export interface CreateSessionInput {
  functionId: string;
  candidateName?: string;
  candidateEmail?: string;
  organizationName?: string;
  invitedBy?: string;
  validityDays?: number;
  /** MCQ section weight (0-100). >0 provisions a keyed MCQ knowledge section
   *  alongside the hands-on blocks (the combined technical assessment). */
  mcqPct?: number;
  /** Custom (pick-and-choose) sitting: a subset of ONE function's skills/tasks.
   *  Indicative by design - a custom sitting issues no credential. */
  isCustom?: boolean;
  /** MCQ section restricted to these function skills (empty = all). */
  selectedSkills?: string[];
  /** Sandbox section restricted to these block ids (empty = all active). */
  selectedBlockIds?: string[];
}
export async function createSession(input: CreateSessionInput) {
  const sb = createServiceClient();
  const mcqPct = Math.max(0, Math.min(100, Math.round(input.mcqPct ?? 0)));
  const isCustom = input.isCustom === true;
  const selectedSkills = (input.selectedSkills ?? []).filter(Boolean);
  const selectedBlockIds = (input.selectedBlockIds ?? []).filter(Boolean);

  // Provision the keyed MCQ test up front (held server-side; stripped before it
  // reaches the browser). Built in English for v1 - the sandbox blocks keep
  // their bilingual toggle; the MCQ section is English-only for now. A custom
  // sitting narrows the MCQ to the chosen skills; a custom sitting with no
  // chosen skills has NO knowledge section (don't fall back to the full set).
  const wantsMcq = mcqPct > 0 && (!isCustom || selectedSkills.length > 0);
  let mcqTest: TechTest | null = null;
  if (wantsMcq) {
    try {
      mcqTest = await buildMcqTestForFunction(
        input.functionId,
        "en",
        isCustom ? selectedSkills : null,
      );
    } catch {
      mcqTest = null;
    }
  }

  const baseRow = {
    function_id: input.functionId,
    candidate_name: input.candidateName ?? null,
    candidate_email: input.candidateEmail ?? null,
    organization_name: input.organizationName ?? null,
    invited_by: input.invitedBy ?? null,
    status: "invited" as const,
  };
  // Only carry the MCQ section when there's a usable test, so a generation
  // miss falls back to sandbox-only rather than an empty knowledge section.
  const mcqRow =
    wantsMcq && mcqTest && mcqTest.items.length > 0
      ? { mcq_pct: mcqPct, mcq_test: mcqTest }
      : {};
  // Custom selection (migration 00121). Store the selections VERBATIM - an empty
  // array is a meaningful "narrow to zero" (e.g. selected_block_ids=[] is a
  // knowledge-only sitting), distinct from NULL (a legacy/full-blueprint sitting).
  const customRow = isCustom
    ? {
        is_custom: true,
        selected_skills: selectedSkills,
        selected_block_ids: selectedBlockIds,
      }
    : {};

  let { data, error } = await sb
    .from("technical_sandbox_sessions")
    .insert({ ...baseRow, ...mcqRow, ...customRow })
    .select("id, access_token")
    .single();
  if (error && isMissingSchemaError(error)) {
    // A custom sitting's "indicative, no credential" guarantee rests on the
    // is_custom column. NEVER silently drop it on a fallback insert - that would
    // let a custom sitting mint a credential. Fail loud instead: custom sittings
    // require migration 00121.
    if (isCustom) {
      throw new Error("Custom technical sittings require migration 00121 to be applied.");
    }
    // Non-custom: tolerant of migration 00085 not applied (retry without MCQ cols).
    ({ data, error } = await sb
      .from("technical_sandbox_sessions")
      .insert(baseRow)
      .select("id, access_token")
      .single());
  }
  if (error || !data) throw error ?? new Error("Could not create session");
  return { id: data.id as string, accessToken: data.access_token as string };
}

export async function getSessionByToken(token: string) {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("technical_sandbox_sessions")
    .select("*")
    .eq("access_token", token)
    .single();
  if (error) return null;
  return data;
}

/** First open: mark in_progress and stamp the expiry from the blueprint's total time. */
export async function startSession(token: string) {
  const sb = createServiceClient();
  const session = await getSessionByToken(token);
  if (!session) throw new Error("Invalid token");
  if (session.status === "submitted") return session;
  if (session.started_at) return session;
  const selectedBlockIds = (session.selected_block_ids ?? null) as string[] | null;
  const blocks = await loadScoringBlocks(session.function_id, selectedBlockIds);
  const sandboxSeconds = (await loadBlocks(session.function_id, selectedBlockIds)).blocks.reduce(
    (s, b) => s + (b.time_limit_seconds ?? 1200),
    0,
  );
  void blocks;
  // Budget extra time for the MCQ knowledge section so it doesn't eat into the
  // hands-on allowance (60s per item).
  const mcqTest = (session.mcq_test ?? null) as TechTest | null;
  const mcqItemCount =
    Number(session.mcq_pct ?? 0) > 0 && mcqTest && Array.isArray(mcqTest.items)
      ? mcqTest.items.length
      : 0;
  const totalSeconds = sandboxSeconds + mcqItemCount * 60;
  const expiresAt = new Date(Date.now() + totalSeconds * 1000).toISOString();
  const { data, error } = await sb
    .from("technical_sandbox_sessions")
    .update({ status: "in_progress", started_at: new Date().toISOString(), expires_at: expiresAt })
    .eq("id", session.id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function saveResponse(token: string, skillBlockId: string, work: SandboxWork) {
  const sb = createServiceClient();
  const session = await getSessionByToken(token);
  if (!session) throw new Error("Invalid token");
  if (session.status === "submitted") throw new Error("Session already submitted");
  const { error } = await sb
    .from("technical_sandbox_responses")
    .upsert(
      {
        session_id: session.id,
        skill_block_id: skillBlockId,
        work,
        status: "in_progress",
        started_at: new Date().toISOString(),
      },
      { onConflict: "session_id,skill_block_id" },
    );
  if (error) throw error;
  return { ok: true };
}

/** Score every block from saved work, persist results, and finalize the sitting.
 *  When the sitting carries an MCQ knowledge section (combined technical
 *  assessment), grade it server-side from the keyed test + the taker's answers,
 *  blend the two sections by the agreed weight, and issue a credential when the
 *  result clears the floors + bar and the knowledge section is bank-certified. */
export async function submitSession(
  token: string,
  mcqAnswers?: Record<string, number | number[]> | null,
) {
  const sb = createServiceClient();
  const session = await getSessionByToken(token);
  if (!session) throw new Error("Invalid token");
  // Already finalized: never echo the raw row (it carries the keyed mcq_test).
  if (session.status === "submitted") return { alreadySubmitted: true as const };

  const selectedBlockIds = (session.selected_block_ids ?? null) as string[] | null;
  const selectedSkills = (session.selected_skills ?? null) as string[] | null;
  // A sitting is custom (indicative, no credential) if EITHER the explicit flag
  // is set OR any narrowing column is present. Defense-in-depth: even if the
  // is_custom flag were ever lost, a stored selection still blocks the credential.
  const isCustom =
    session.is_custom === true || selectedSkills != null || selectedBlockIds != null;
  const scoringBlocks = await loadScoringBlocks(session.function_id, selectedBlockIds);
  const { data: responses } = await sb
    .from("technical_sandbox_responses")
    .select("skill_block_id, work")
    .eq("session_id", session.id);
  const workByBlock = new Map<string, SandboxWork>(
    (responses ?? []).map((r) => [r.skill_block_id, (r.work ?? {}) as SandboxWork]),
  );

  const blockInputs: BlockInput[] = [];
  for (const blk of scoringBlocks) {
    const work = workByBlock.get(blk.id) ?? {};
    let precomputed: Record<string, boolean> | undefined;
    if (blk.engineType === "sql") {
      precomputed = {};
      const cfg = blk.engineConfig as unknown as SqlEngineConfig;
      const masterQuery = (blk.masterSolution as { master_query?: string }).master_query ?? "";
      const candidateQuery = (work as { query?: string }).query ?? "";
      for (const cp of blk.checkpoints) {
        if (cp.kind === "sql_result_match") {
          const res = await runSqlCheckpoint(
            cfg,
            candidateQuery,
            masterQuery,
            cp.ordered ?? true,
          );
          precomputed[cp.id] = res.ok && res.matches;
        }
      }
    }
    const score = scoreBlock(blk.checkpoints, work, precomputed);
    await sb
      .from("technical_sandbox_responses")
      .upsert(
        {
          session_id: session.id,
          skill_block_id: blk.id,
          work,
          status: "validated",
          score_pct: score.scorePct,
          band: score.tier,
          checkpoint_results: score.checkpointResults,
          submitted_at: new Date().toISOString(),
          validated_at: new Date().toISOString(),
        },
        { onConflict: "session_id,skill_block_id" },
      );
    blockInputs.push({
      skillBlockId: blk.id,
      pillarId: blk.pillarId,
      pillarNameEn: blk.pillarNameEn,
      pillarNameAr: blk.pillarNameAr,
      pillarSort: blk.pillarSort,
      nameEn: blk.nameEn,
      nameAr: blk.nameAr,
      score,
    });
  }

  const sessionScore = scoreSession(blockInputs);

  // ── Combined (MCQ + sandbox) blend, when the sitting carries a knowledge section ──
  const mcqPct = Math.max(0, Math.min(100, Math.round(Number(session.mcq_pct ?? 0))));
  const mcqTest = (session.mcq_test ?? null) as TechTest | null;
  const hasMcqSection = mcqPct > 0 && !!mcqTest && Array.isArray(mcqTest.items) && mcqTest.items.length > 0;

  const mcqScorePct = hasMcqSection ? gradeMcqTest(mcqTest, mcqAnswers ?? {}) : null;
  const combined = combineScores({
    mcqPct,
    mcqScorePct,
    sandboxScorePct: sessionScore.overallPct,
  });

  // ── Finalize atomically. The status transition is a compare-and-set
  //    (.neq("status","submitted")) so two concurrent submits can't both
  //    proceed: only the row that flips in_progress -> submitted is "claimed",
  //    and only that winner issues the credential. Credential is issued AFTER
  //    the claim, never before, so a lost race issues nothing. ──
  const baseUpdate = {
    status: "submitted" as const,
    submitted_at: new Date().toISOString(),
    overall_score_pct: sessionScore.overallPct,
    overall_band: sessionScore.overallTier,
  };
  const combinedCols = {
    mcq_answers: hasMcqSection ? (mcqAnswers ?? {}) : null,
    mcq_score_pct: mcqScorePct,
    combined_score_pct: combined.combinedPct,
    combined_band: combined.combinedBand,
  };

  let { data: claimed, error } = await sb
    .from("technical_sandbox_sessions")
    .update({ ...baseUpdate, ...combinedCols })
    .eq("id", session.id)
    .neq("status", "submitted")
    .select("id")
    .maybeSingle();
  // Tolerant of migration 00085 not applied: persist the legacy columns only.
  if (error && isMissingSchemaError(error)) {
    ({ data: claimed, error } = await sb
      .from("technical_sandbox_sessions")
      .update(baseUpdate)
      .eq("id", session.id)
      .neq("status", "submitted")
      .select("id")
      .maybeSingle());
  }
  if (error) throw error;
  // Lost the race (a concurrent submit already finalized) -> do not re-issue.
  if (!claimed) return { alreadySubmitted: true as const };

  // The technical_proficiency credential keeps its "bank-certified" invariant:
  // issued only for a passing combined sitting whose knowledge section was
  // assembled from SME-approved bank items (not an AI-generated fallback).
  // Sandbox half certification (Build 2): every scored hands-on task must be
  // SME-approved (review_status='approved') for a certified combined credential.
  // Tolerant of migration 00120 not being applied (the review_status read fails
  // -> rev is null -> sandboxCertified stays true, preserving prior behaviour).
  let sandboxCertified = true;
  {
    const scoredBlockIds = scoringBlocks.map((b) => b.id);
    if (scoredBlockIds.length > 0) {
      const { data: rev } = await sb
        .from("technical_skill_blocks")
        .select("id, review_status")
        .in("id", scoredBlockIds);
      if (rev && rev.length > 0) {
        sandboxCertified = rev.every(
          (r) => (r as { review_status?: string }).review_status === "approved",
        );
      }
    }
  }

  let credentialCode: string | null = null;
  // A custom (pick-and-choose) sitting is indicative by design - a hand-picked
  // subset of the function blueprint is not the certified whole, so it NEVER
  // issues a credential even if the chosen tasks happen to be SME-approved.
  const eligibleToCertify =
    !isCustom && hasMcqSection && !!mcqTest?.certified && combined.passed && sandboxCertified;
  if (eligibleToCertify) {
    // Idempotency: reuse an existing credential for this sitting if one exists
    // (mirrors markEnrollmentComplete) so a retry can't mint a duplicate.
    let existingCode: string | null = null;
    try {
      const { data: existing } = await sb
        .from("vifm_credentials")
        .select("verification_code")
        .eq("source_id", session.id)
        .eq("credential_type", "technical_proficiency")
        .maybeSingle<{ verification_code: string }>();
      existingCode = existing?.verification_code ?? null;
    } catch {
      existingCode = null;
    }
    credentialCode =
      existingCode ??
      (
        await issueCredential({
          candidateId: null,
          issuedToName: (session.candidate_name as string) || "Candidate",
          issuedToEmail: (session.candidate_email as string) || null,
          type: "technical_proficiency",
          titleEn: "Technical Proficiency",
          titleAr: "الكفاءة الفنية",
          subtitleEn: (session.organization_name as string) || null,
          scorePct: combined.combinedPct,
          sourceId: session.id as string,
          metadata: {
            kind: "technical_combined",
            function_id: session.function_id,
            mcq_pct: mcqPct,
            mcq_score_pct: mcqScorePct,
            sandbox_score_pct: sessionScore.overallPct,
            combined_score_pct: combined.combinedPct,
            band: combined.combinedBand,
          },
        })
      )?.verificationCode ??
      null;
    if (credentialCode) {
      // Best-effort; tolerant of 00085 not applied (column absent -> no-op).
      await sb
        .from("technical_sandbox_sessions")
        .update({ credential_code: credentialCode })
        .eq("id", session.id);
    }
  }

  return {
    score: sessionScore,
    combined: {
      mcqPct,
      hasMcqSection,
      mcqScorePct,
      sandboxScorePct: sessionScore.overallPct,
      combinedPct: combined.combinedPct,
      combinedBand: combined.combinedBand,
      mcqPassed: combined.mcqPassed,
      sandboxPassed: combined.sandboxPassed,
      passed: combined.passed,
      certified: !!mcqTest?.certified,
      credentialCode,
    },
  };
}

// ── Admin-only answer key (model answers + checkpoints) for active functions ──
export interface AnswerKeyCheckpoint {
  id: string;
  kind: string;
  weight: number;
  label: string;
  target?: string;
  field?: string;
  expected?: number | string;
}
export interface AnswerKeyBlock {
  id: string;
  nameEn: string;
  pillarNameEn: string;
  engineType: EngineType;
  frameworkRef: string | null;
  timeLimitSeconds: number;
  /** Per editable cell: label + model formula (hint) + expected value. */
  cells?: { ref: string; label?: string; formula?: string; expected?: number }[];
  /** Logic-input: field + expected value. */
  fields?: { id: string; label: string; expected?: number }[];
  /** SQL: master query. */
  masterQuery?: string;
  checkpoints: AnswerKeyCheckpoint[];
}
export interface AnswerKeyFunction {
  functionId: string;
  nodeId: string | null;
  nameEn: string;
  blocks: AnswerKeyBlock[];
}

export async function getAnswerKey(): Promise<AnswerKeyFunction[]> {
  const sb = createServiceClient();
  const { data: fns, error } = await sb
    .from("technical_functions")
    .select("id, node_id, name_en")
    .eq("node_status", "active")
    .order("node_id");
  if (error) throw error;

  const out: AnswerKeyFunction[] = [];
  for (const fn of fns ?? []) {
    const { pillars, blocks } = await loadBlocks(fn.id);
    const pillarById = new Map(pillars.map((p) => [p.id, p]));
    const akBlocks: AnswerKeyBlock[] = blocks.map((b) => {
      const engineType = b.engine_type as EngineType;
      const cfg = (b.engine_config ?? {}) as Record<string, unknown>;
      const master = (b.master_solution ?? {}) as Record<string, unknown>;
      const checkpoints = ((b.checkpoints ?? []) as Record<string, unknown>[]).map((c) => ({
        id: String(c.id),
        kind: String(c.kind),
        weight: Number(c.weight ?? 1),
        label: String(c.label_en ?? c.id),
        target: c.target ? String(c.target) : undefined,
        field: c.field ? String(c.field) : undefined,
        expected: c.expected as number | string | undefined,
      }));

      const block: AnswerKeyBlock = {
        id: b.id,
        nameEn: b.name_en,
        pillarNameEn: pillarById.get(b.pillar_id)?.name_en ?? "",
        engineType,
        frameworkRef: b.framework_ref,
        timeLimitSeconds: b.time_limit_seconds,
        checkpoints,
      };

      if (engineType === "spreadsheet" || engineType === "advanced_spreadsheet") {
        const rows = (cfg.rows ?? []) as { ref?: string; A?: string | number; hint?: string }[];
        const editable = ((cfg.editable ?? []) as string[]).flatMap((e) =>
          e.includes(":") ? [e] : [e],
        );
        const masterCells = (master.cells ?? {}) as Record<string, number>;
        const byRef = new Map(rows.filter((r) => r.ref).map((r) => [r.ref as string, r]));
        block.cells = editable.map((ref) => {
          const row = byRef.get(ref);
          return {
            ref,
            label: row?.A != null ? String(row.A).trim() : undefined,
            formula: row?.hint,
            expected: masterCells[ref],
          };
        });
      } else if (engineType === "logic_input") {
        const fields = (cfg.fields ?? []) as { id: string; label_en?: string }[];
        const masterFields = (master.fields ?? {}) as Record<string, number>;
        block.fields = fields.map((f) => ({
          id: f.id,
          label: f.label_en ?? f.id,
          expected: masterFields[f.id],
        }));
      } else if (engineType === "sql") {
        block.masterQuery = (master.master_query as string) ?? "";
      }
      return block;
    });
    out.push({ functionId: fn.id, nodeId: fn.node_id, nameEn: fn.name_en, blocks: akBlocks });
  }
  return out;
}

// ── Completed-session report data (for PDF + future email) ──
export interface ReportBlock {
  nameEn: string;
  nameAr: string | null;
  /** Plain-English (and Arabic) definition of what this subcategory tested. */
  descriptionEn: string | null;
  descriptionAr: string | null;
  frameworkRef: string | null;
  scorePct: number;
  band: string;
  checkpoints: { label: string; passed: boolean }[];
}
export interface ReportPillar {
  nameEn: string;
  nameAr: string | null;
  /** Plain-English (and Arabic) definition of what this category tested. */
  descriptionEn: string | null;
  descriptionAr: string | null;
  advancedCount: number;
  intermediateCount: number;
  basicCount: number;
  /** Development guidance for this category (null when it is a strength). */
  developmentFocusEn: string | null;
  developmentFocusAr: string | null;
  blocks: ReportBlock[];
}
/** Per-subcategory breakdown of the knowledge (MCQ) section. */
export interface ReportKnowledgeSkill {
  skill: string;
  scorePct: number;
  band: string;
  total: number;
}
export interface SessionReport {
  functionName: string;
  nodeId: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  organizationName: string | null;
  submittedAt: string | null;
  overallPct: number;
  overallBand: string;
  /** Knowledge-section overall %, null when the sitting had no MCQ section. */
  knowledgePct: number | null;
  /** Per-subcategory knowledge bands (empty when there was no MCQ section). */
  knowledgeSkills: ReportKnowledgeSkill[];
  /** Short plain-language performance summary for the reviewing manager. */
  narrativeEn: string;
  narrativeAr: string;
  pillars: ReportPillar[];
}

function techBandSentenceEn(band: string): string {
  if (band === "advanced") return "performance is strong and consistent across the assessed areas";
  if (band === "intermediate") return "performance is solid, with clear areas to strengthen";
  return "performance shows foundational ability with significant room to develop";
}
function techBandSentenceAr(band: string): string {
  if (band === "advanced") return "الأداء قوي ومتسق عبر المجالات المُقيَّمة";
  if (band === "intermediate") return "الأداء جيد مع مجالات واضحة للتعزيز";
  return "يُظهر الأداء قدرة تأسيسية مع مجال كبير للتطوير";
}
function techBandLabelAr(band: string): string {
  if (band === "advanced") return "متقدمة";
  if (band === "intermediate") return "متوسطة";
  return "أساسية";
}
// Development guidance per category band (this is a DEVELOPMENT report read by
// the candidate's manager / L&D lead - not a pass/fail). Advanced areas are a
// strength, so they carry no development focus.
function techDevFocusEn(band: string): string | null {
  if (band === "basic") return "Priority development area - build foundational capability here through structured training and supervised practice.";
  if (band === "intermediate") return "Developing - strengthen through applied practice and targeted upskilling on the weaker subcategories.";
  return null;
}
function techDevFocusAr(band: string): string | null {
  if (band === "basic") return "مجال تطوير ذو أولوية - ابنِ القدرة الأساسية هنا عبر تدريب منظم وممارسة موجَّهة.";
  if (band === "intermediate") return "قيد التطور - عزِّز عبر الممارسة التطبيقية والتأهيل الموجَّه على المجالات الفرعية الأضعف.";
  return null;
}

export async function getSessionReport(token: string): Promise<SessionReport | null> {
  const sb = createServiceClient();
  const session = await getSessionByToken(token);
  if (!session || session.status !== "submitted") return null;

  const { data: fn } = await sb
    .from("technical_functions")
    .select("name_en, node_id")
    .eq("id", session.function_id)
    .single();
  const selectedBlockIds = (session.selected_block_ids ?? null) as string[] | null;
  const { pillars, blocks } = await loadBlocks(session.function_id, selectedBlockIds);
  const { data: responses } = await sb
    .from("technical_sandbox_responses")
    .select("skill_block_id, score_pct, band, checkpoint_results")
    .eq("session_id", session.id);
  const byBlock = new Map(
    (responses ?? []).map((r) => [r.skill_block_id, r]),
  );

  const reportPillars: ReportPillar[] = pillars.map((p) => {
    const pBlocks = blocks.filter((b) => b.pillar_id === p.id);
    const rBlocks: ReportBlock[] = pBlocks.map((b) => {
      const resp = byBlock.get(b.id);
      const cps = ((resp?.checkpoint_results ?? []) as { label_en?: string; id?: string; passed?: boolean }[]).map(
        (c) => ({ label: c.label_en ?? c.id ?? "", passed: !!c.passed }),
      );
      return {
        nameEn: b.name_en,
        nameAr: b.name_ar ?? null,
        descriptionEn: b.description_en ?? null,
        descriptionAr: b.description_ar ?? null,
        frameworkRef: b.framework_ref,
        scorePct: Number(resp?.score_pct ?? 0),
        band: String(resp?.band ?? "basic"),
        checkpoints: cps,
      };
    });
    const pMean = rBlocks.length ? Math.round(rBlocks.reduce((a, b) => a + b.scorePct, 0) / rBlocks.length) : null;
    const pBand = pMean != null ? tierFor(pMean) : null;
    return {
      nameEn: p.name_en,
      nameAr: p.name_ar ?? null,
      descriptionEn: p.description_en ?? null,
      descriptionAr: p.description_ar ?? null,
      advancedCount: rBlocks.filter((x) => x.band === "advanced").length,
      intermediateCount: rBlocks.filter((x) => x.band === "intermediate").length,
      basicCount: rBlocks.filter((x) => x.band === "basic").length,
      developmentFocusEn: pBand ? techDevFocusEn(pBand) : null,
      developmentFocusAr: pBand ? techDevFocusAr(pBand) : null,
      blocks: rBlocks,
    };
  });

  // Knowledge (MCQ) section: recompute the per-subcategory breakdown from the
  // stored keyed test + the taker's answers, so the report bands EVERY knowledge
  // subcategory, not just the four hands-on tasks.
  const knowledgeSkills: ReportKnowledgeSkill[] = [];
  let knowledgePct: number | null = null;
  const mcqTest = (session.mcq_test ?? null) as TechTest | null;
  const mcqAnswers = (session.mcq_answers ?? null) as Record<string, number | number[]> | null;
  if (mcqTest && Array.isArray(mcqTest.items) && mcqTest.items.length > 0 && mcqAnswers) {
    const scored = scoreTechnicalAssessment({ test: mcqTest, answers: mcqAnswers });
    knowledgePct = scored.pct;
    for (const sk of scored.perSkill) {
      const pct = sk.total > 0 ? Math.round((100 * sk.correct) / sk.total) : 0;
      knowledgeSkills.push({ skill: sk.skill, scorePct: pct, band: tierFor(pct), total: sk.total });
    }
  } else if (session.mcq_score_pct != null) {
    knowledgePct = Number(session.mcq_score_pct);
  }

  const overallPct = Number(session.overall_score_pct ?? 0);
  const overallBand = String(session.overall_band ?? "basic");

  // Deterministic candidate narrative across the assessed areas (each pillar by
  // its mean block score, plus the knowledge section).
  type Area = { nameEn: string; nameAr: string; mean: number };
  const areas: Area[] = reportPillars
    .filter((p) => p.blocks.length > 0)
    .map((p) => ({
      nameEn: p.nameEn,
      nameAr: p.nameAr ?? p.nameEn,
      mean: p.blocks.reduce((a, b) => a + b.scorePct, 0) / p.blocks.length,
    }));
  if (knowledgePct != null) areas.push({ nameEn: "Knowledge", nameAr: "المعرفة", mean: knowledgePct });
  let strongest: Area | null = null;
  let weakest: Area | null = null;
  for (const a of areas) {
    if (strongest === null || a.mean > strongest.mean) strongest = a;
    if (weakest === null || a.mean < weakest.mean) weakest = a;
  }
  const showSW = !!strongest && !!weakest && areas.length > 1 && strongest.nameEn !== weakest.nameEn;
  const narrativeEn =
    `This is a development read of the candidate's technical skill. Overall, a ${overallBand} result at ${overallPct}%, where ${techBandSentenceEn(overallBand)}.` +
    (showSW
      ? ` ${strongest!.nameEn} is a relative strength to build on; prioritise development in ${weakest!.nameEn}. See the per-area development focus below.`
      : " See the per-area development focus below.");
  const narrativeAr =
    `هذه قراءة تطويرية لمهارة المرشح التقنية. بشكل عام، النتيجة ${techBandLabelAr(overallBand)} عند ${overallPct}%، حيث ${techBandSentenceAr(overallBand)}.` +
    (showSW
      ? ` يُعدّ ${strongest!.nameAr} نقطة قوة نسبية يمكن البناء عليها؛ وتنبغي أولوية التطوير في ${weakest!.nameAr}. انظر تركيز التطوير لكل مجال أدناه.`
      : " انظر تركيز التطوير لكل مجال أدناه.");

  return {
    functionName: fn?.name_en ?? "Technical Assessment",
    nodeId: fn?.node_id ?? null,
    candidateName: session.candidate_name,
    candidateEmail: session.candidate_email,
    organizationName: session.organization_name,
    submittedAt: session.submitted_at,
    overallPct,
    overallBand,
    knowledgePct,
    knowledgeSkills,
    narrativeEn,
    narrativeAr,
    pillars: reportPillars,
  };
}

// ── Admin: list submitted sittings (for the client/admin results view) ──
export interface SubmittedSessionRow {
  token: string;
  candidateName: string | null;
  candidateEmail: string | null;
  organizationName: string | null;
  functionName: string;
  nodeId: string | null;
  submittedAt: string | null;
  overallPct: number | null;
  overallBand: string | null;
}

export async function listSubmittedSessions(limit = 100): Promise<SubmittedSessionRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("technical_sandbox_sessions")
    .select(
      "access_token, candidate_name, candidate_email, organization_name, submitted_at, overall_score_pct, overall_band, function:technical_functions(name_en, node_id)",
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return ((data ?? []) as unknown as Array<{
    access_token: string;
    candidate_name: string | null;
    candidate_email: string | null;
    organization_name: string | null;
    submitted_at: string | null;
    overall_score_pct: number | null;
    overall_band: string | null;
    function: { name_en: string; node_id: string | null } | null;
  }>).map((r) => ({
    token: r.access_token,
    candidateName: r.candidate_name,
    candidateEmail: r.candidate_email,
    organizationName: r.organization_name,
    functionName: r.function?.name_en ?? "Technical Assessment",
    nodeId: r.function?.node_id ?? null,
    submittedAt: r.submitted_at,
    overallPct: r.overall_score_pct != null ? Number(r.overall_score_pct) : null,
    overallBand: r.overall_band ?? null,
  }));
}

// ── Admin: sandbox blocks for SME review (per function, grouped by pillar) ──
export interface ReviewBlock {
  id: string;
  nameEn: string;
  engineType: string;
  status: string;        // runtime visibility (active/inactive)
  reviewStatus: string;  // SME workflow (draft/in_review/approved/rejected/retired)
  reviewerName: string | null;
  reviewedAt: string | null;
}
export interface ReviewPillar {
  pillarId: string;
  pillarName: string;
  blocks: ReviewBlock[];
}

export async function listBlocksForReview(functionId: string): Promise<ReviewPillar[]> {
  const sb = createServiceClient();
  const { data: pillars, error: pErr } = await sb
    .from("technical_pillars")
    .select("id, name_en, sort_order")
    .eq("function_id", functionId)
    .order("sort_order");
  if (pErr) {
    if (isMissingSchemaError(pErr)) return [];
    throw pErr;
  }
  const pids = (pillars ?? []).map((p) => p.id);
  if (pids.length === 0) return [];

  const { data: blocks, error: bErr } = await sb
    .from("technical_skill_blocks")
    .select("id, pillar_id, name_en, engine_type, status, review_status, reviewer_name, reviewed_at")
    .in("pillar_id", pids)
    .order("sort_order");
  // Tolerate migration 00120 not applied (review_status column absent).
  const rows = bErr
    ? (isMissingSchemaError(bErr) ? [] : (() => { throw bErr; })())
    : (blocks ?? []);

  return (pillars ?? []).map((p) => ({
    pillarId: p.id,
    pillarName: p.name_en,
    blocks: (rows as Array<Record<string, unknown>>)
      .filter((b) => b.pillar_id === p.id)
      .map((b) => ({
        id: String(b.id),
        nameEn: String(b.name_en),
        engineType: String(b.engine_type),
        status: String(b.status ?? "active"),
        reviewStatus: String(b.review_status ?? "draft"),
        reviewerName: (b.reviewer_name as string | null) ?? null,
        reviewedAt: (b.reviewed_at as string | null) ?? null,
      })),
  }));
}

export async function setBlockReviewStatus(
  blockId: string,
  reviewStatus: "draft" | "in_review" | "approved" | "rejected" | "retired",
  reviewerName: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("technical_skill_blocks")
    .update({
      review_status: reviewStatus,
      reviewer_name: reviewerName,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", blockId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Framework overview (showcase): domains -> functions -> (active) pillars/blocks ──
export interface OverviewBlock { nameEn: string; engineType: EngineType; frameworkRef: string | null }
export interface OverviewPillar { nameEn: string; blocks: OverviewBlock[] }
export interface OverviewFunction {
  id: string;
  nodeId: string | null;
  nameEn: string;
  status: "active" | "inactive";
  pillars: OverviewPillar[];
}
export interface OverviewDomain {
  key: string;
  nameEn: string;
  functions: OverviewFunction[];
}

export async function getFrameworkOverview(): Promise<OverviewDomain[]> {
  const sb = createServiceClient();
  const { data: domains } = await sb
    .from("technical_domains")
    .select("key, name_en, sort_order")
    .order("sort_order");
  const { data: fns } = await sb
    .from("technical_functions")
    .select("id, node_id, name_en, domain_key, node_status")
    .not("node_id", "is", null)
    .order("node_id");

  // Pillars/blocks only for active functions (cheap; one active today).
  const activeIds = (fns ?? []).filter((f) => f.node_status === "active").map((f) => f.id);
  const pillarsByFn = new Map<string, OverviewPillar[]>();
  for (const fid of activeIds) {
    const { pillars, blocks } = await loadBlocks(fid);
    pillarsByFn.set(
      fid,
      pillars.map((p) => ({
        nameEn: p.name_en,
        blocks: blocks
          .filter((b) => b.pillar_id === p.id)
          .map((b) => ({
            nameEn: b.name_en,
            engineType: b.engine_type as EngineType,
            frameworkRef: b.framework_ref,
          })),
      })),
    );
  }

  const order = new Map((domains ?? []).map((d, i) => [d.key, i]));
  const wanted = new Set((domains ?? []).map((d) => d.key));
  const byDomain = new Map<string, OverviewFunction[]>();
  for (const f of fns ?? []) {
    if (!f.domain_key || !wanted.has(f.domain_key)) continue;
    const arr = byDomain.get(f.domain_key) ?? [];
    arr.push({
      id: f.id,
      nodeId: f.node_id,
      nameEn: f.name_en,
      status: f.node_status as "active" | "inactive",
      pillars: pillarsByFn.get(f.id) ?? [],
    });
    byDomain.set(f.domain_key, arr);
  }

  return (domains ?? [])
    .filter((d) => byDomain.has(d.key))
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0))
    .map((d) => ({ key: d.key, nameEn: d.name_en, functions: byDomain.get(d.key) ?? [] }));
}
