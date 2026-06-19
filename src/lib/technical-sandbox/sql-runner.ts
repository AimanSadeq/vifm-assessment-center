// ─────────────────────────────────────────────────────────────
// SQL sandbox runner (server-only). Executes a candidate's query for a
// `sql` skill block and hash-matches the result against the master.
//
// Safety (Decision 12 - read-only, contained):
//   1. Runs against a DEDICATED throwaway database (SANDBOX_DATABASE_URL),
//      NEVER the app/Supabase DB.
//   2. The candidate query is guarded to a single SELECT/WITH statement.
//   3. Trusted schema+seed and the candidate query run inside ONE
//      transaction that is ALWAYS rolled back.
//   4. A per-statement timeout bounds runaway queries.
// ─────────────────────────────────────────────────────────────
import { Pool } from "pg";
import { createHash } from "node:crypto";

const STATEMENT_TIMEOUT_MS = 5000;

let pool: Pool | null = null;
function getPool(): Pool | null {
  const url = process.env.SANDBOX_DATABASE_URL;
  if (!url) return null;
  if (!pool) pool = new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 10_000 });
  return pool;
}

export interface SqlEngineConfig {
  dialect?: string;
  schema_sql: string;
  seed_sql: string;
  prompt_en?: string;
  prompt_ar?: string;
}
export interface SqlRunResult {
  ok: boolean;
  matches: boolean;
  error?: string;
  candidateHash?: string;
  masterHash?: string;
  rowCount?: number;
}

/** Single read-only statement guard. Rejects multi-statement / mutating SQL. */
export function isSafeSelect(query: string): boolean {
  const q = query.trim().replace(/;\s*$/, "");
  if (q.length === 0) return false;
  if (q.includes(";")) return false; // no statement chaining
  if (!/^(select|with)\b/i.test(q)) return false;
  // Block obvious mutating / DDL keywords as whole words anywhere.
  if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|merge|vacuum|reindex)\b/i.test(q)) {
    return false;
  }
  return true;
}

function canonicalize(rows: Record<string, unknown>[], ordered: boolean): string {
  // Stable per-row serialization (sorted keys); optionally sort rows so an
  // unordered query still matches the master set.
  const serRow = (r: Record<string, unknown>) =>
    JSON.stringify(
      Object.keys(r)
        .sort()
        .map((k) => [k, normalizeVal(r[k])]),
    );
  const rowStrs = rows.map(serRow);
  if (!ordered) rowStrs.sort();
  return rowStrs.join("\n");
}
function normalizeVal(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  // numeric strings (pg returns numeric/bigint as string) -> normalized number text
  const n = Number(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(n)) return n;
  if (typeof v === "number") return v;
  return String(v);
}
function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

/**
 * Health check: prove the sandbox DB is reachable and supports the full
 * pattern (temp table -> insert -> select -> rollback). Used by the admin
 * "Test sandbox DB" button to validate SANDBOX_DATABASE_URL.
 */
export async function pingSandboxDb(): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "SANDBOX_DATABASE_URL is not configured." };
  let client;
  try {
    client = await p.connect();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query("CREATE TEMP TABLE _ping (n int)");
    await client.query("INSERT INTO _ping VALUES (1)");
    const r = await client.query("SELECT count(*)::int AS c FROM _ping");
    const ver = await client.query("SELECT version()");
    return {
      ok: true,
      detail: `Connected. Temp-table roundtrip OK (rows=${r.rows[0].c}). ${String(ver.rows[0].version).split(",")[0]}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    client.release();
  }
}

export async function runSqlCheckpoint(
  config: SqlEngineConfig,
  candidateQuery: string,
  masterQuery: string,
  ordered = true,
): Promise<SqlRunResult> {
  if (!isSafeSelect(candidateQuery)) {
    return { ok: false, matches: false, error: "Query must be a single SELECT/WITH statement." };
  }
  const p = getPool();
  if (!p) {
    return { ok: false, matches: false, error: "SANDBOX_DATABASE_URL is not configured." };
  }
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    // Trusted setup (rewrite to TEMP so nothing persists even before rollback).
    const schemaTemp = config.schema_sql.replace(/create\s+table/gi, "CREATE TEMP TABLE");
    await client.query(schemaTemp);
    await client.query(config.seed_sql);
    const master = await client.query(masterQuery);
    const candidate = await client.query(candidateQuery);
    const masterHash = hash(canonicalize(master.rows, ordered));
    const candidateHash = hash(canonicalize(candidate.rows, ordered));
    return {
      ok: true,
      matches: masterHash === candidateHash,
      masterHash,
      candidateHash,
      rowCount: candidate.rowCount ?? candidate.rows.length,
    };
  } catch (err: unknown) {
    return { ok: false, matches: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    client.release();
  }
}
