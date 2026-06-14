// ─────────────────────────────────────────────────────────────
// Technical sandbox service (server-only). Bridges the 00077 schema to
// the validators/scoring. Loads blueprints, manages token-accessed
// sittings, autosaves work, and scores on submit.
//
// SECURITY: the public (candidate) blueprint NEVER includes
// master_solution or checkpoints — those stay server-side for scoring.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { scoreBlock } from "./validators";
import { scoreSession, type BlockInput } from "./scoring";
import { runSqlCheckpoint, type SqlEngineConfig } from "./sql-runner";
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

async function loadBlocks(functionId: string) {
  const sb = createServiceClient();
  const { data: pillars, error: pErr } = await sb
    .from("technical_pillars")
    .select("id, name_en, name_ar, sort_order")
    .eq("function_id", functionId)
    .order("sort_order");
  if (pErr) {
    if (isMissingSchemaError(pErr)) return { pillars: [], blocks: [] };
    throw pErr;
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
  return { pillars: pillars ?? [], blocks: blocks ?? [] };
}

/** Public blueprint for the candidate runner (no answer key). */
export async function getPublicBlueprint(functionId: string): Promise<PublicBlueprint> {
  const sb = createServiceClient();
  const { data: fn, error } = await sb
    .from("technical_functions")
    .select("id, key, node_id, name_en, name_ar")
    .eq("id", functionId)
    .single();
  if (error) throw error;
  const { pillars, blocks } = await loadBlocks(functionId);
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

async function loadScoringBlocks(functionId: string): Promise<ScoringBlock[]> {
  const { pillars, blocks } = await loadBlocks(functionId);
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
}
export async function createSession(input: CreateSessionInput) {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("technical_sandbox_sessions")
    .insert({
      function_id: input.functionId,
      candidate_name: input.candidateName ?? null,
      candidate_email: input.candidateEmail ?? null,
      organization_name: input.organizationName ?? null,
      invited_by: input.invitedBy ?? null,
      status: "invited",
    })
    .select("id, access_token")
    .single();
  if (error) throw error;
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
  const blocks = await loadScoringBlocks(session.function_id);
  const totalSeconds = (await loadBlocks(session.function_id)).blocks.reduce(
    (s, b) => s + (b.time_limit_seconds ?? 1200),
    0,
  );
  void blocks;
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

/** Score every block from saved work, persist results, and finalize the sitting. */
export async function submitSession(token: string) {
  const sb = createServiceClient();
  const session = await getSessionByToken(token);
  if (!session) throw new Error("Invalid token");
  if (session.status === "submitted") return session;

  const scoringBlocks = await loadScoringBlocks(session.function_id);
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
  const { data: updated, error } = await sb
    .from("technical_sandbox_sessions")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      overall_score_pct: sessionScore.overallPct,
      overall_band: sessionScore.overallTier,
    })
    .eq("id", session.id)
    .select("*")
    .single();
  if (error) throw error;
  return { session: updated, score: sessionScore };
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
  frameworkRef: string | null;
  scorePct: number;
  band: string;
  checkpoints: { label: string; passed: boolean }[];
}
export interface ReportPillar {
  nameEn: string;
  advancedCount: number;
  intermediateCount: number;
  basicCount: number;
  blocks: ReportBlock[];
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
  pillars: ReportPillar[];
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
  const { pillars, blocks } = await loadBlocks(session.function_id);
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
        frameworkRef: b.framework_ref,
        scorePct: Number(resp?.score_pct ?? 0),
        band: String(resp?.band ?? "basic"),
        checkpoints: cps,
      };
    });
    return {
      nameEn: p.name_en,
      advancedCount: rBlocks.filter((x) => x.band === "advanced").length,
      intermediateCount: rBlocks.filter((x) => x.band === "intermediate").length,
      basicCount: rBlocks.filter((x) => x.band === "basic").length,
      blocks: rBlocks,
    };
  });

  return {
    functionName: fn?.name_en ?? "Technical Assessment",
    nodeId: fn?.node_id ?? null,
    candidateName: session.candidate_name,
    candidateEmail: session.candidate_email,
    organizationName: session.organization_name,
    submittedAt: session.submitted_at,
    overallPct: Number(session.overall_score_pct ?? 0),
    overallBand: String(session.overall_band ?? "basic"),
    pillars: reportPillars,
  };
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
