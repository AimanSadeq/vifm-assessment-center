import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import { PURGED } from "@/lib/privacy/purged";
import { retentionCutoffIso } from "./policy";

/**
 * Executes the one retention policy (policy.ts) against a service's tables.
 *
 * Every step is paginated and chunked. An un-paginated id-gather silently caps
 * at 1000 rows, which would purge 1000 per run and leave the rest of a backlog
 * sitting past the window - the failure mode is invisible, because the purge
 * still reports success.
 */

/** Rows whose personal content IS the record: deleted outright. */
export type DeleteStep = {
  table: string;
  /** Timestamp column that dates the row. Default created_at. */
  tsCol?: string;
  /** Extra equality filters, e.g. { kind: "cognitive" } to scope a shared table. */
  match?: Record<string, string>;
  /**
   * Columns that must be NULL for the row to be in scope. Not a nicety: Persona
   * shares one table between self-served sittings (candidate_id NULL) and
   * engagement-bound ones that feed Succession Readiness and are governed by
   * the engagement's own lifecycle, not this window. Without this the purge
   * would take both.
   */
  matchNull?: string[];
  /**
   * Storage objects that belong to the rows being deleted. The child table's
   * rows cascade away with the parent, so the object paths are read and the
   * files removed FIRST, chunk by chunk, or the blobs would be orphaned in the
   * bucket. Dry runs touch nothing.
   */
  storage?: StorageCleanup;
};

export type StorageCleanup = {
  bucket: string;
  /** Child table holding the object paths, e.g. bundle_report_files. */
  table: string;
  /** Its foreign key to the deleted rows' id. */
  fkCol: string;
  /** Its column holding the bucket path. */
  pathCol: string;
};

/** Voucher redemptions: row kept for the seat ledger, person removed. */
export type AnonymiseStep = {
  table: string;
  /** Default redeemed_at. */
  tsCol?: string;
};

/**
 * Short-lived keyed sessions. Swept on their own TTL rather than the retention
 * window - they are useless once expired but carry the answer key and often an
 * email, so nothing should keep them for two years.
 */
export type SweepStep = {
  table: string;
  /** Default expires_at. */
  expiresCol?: string;
  match?: Record<string, string>;
};

export type RetentionSpec = {
  key: string;
  label: string;
  deletes?: DeleteStep[];
  anonymise?: AnonymiseStep[];
  sweeps?: SweepStep[];
};

export type RetentionOutcome = {
  key: string;
  label: string;
  deleted: number;
  anonymised: number;
  swept: number;
  /** Per-step problems. A step that fails never aborts the others: a missing
   *  table on one service must not stop the rest of the platform being purged. */
  errors: string[];
};

type Sb = ReturnType<typeof createServiceClient>;

function applyMatch<T>(q: T, match?: Record<string, string>, matchNull?: string[]): T {
  let out = q;
  for (const [col, val] of Object.entries(match ?? {})) {
    out = (out as { eq: (c: string, v: string) => T }).eq(col, val);
  }
  for (const col of matchNull ?? []) {
    out = (out as { is: (c: string, v: null) => T }).is(col, null);
  }
  return out;
}

async function countStep(sb: Sb, step: DeleteStep, cutoff: string): Promise<number> {
  const base = sb.from(step.table).select("id", { count: "exact", head: true });
  const { count } = await applyMatch(base, step.match, step.matchNull).lt(step.tsCol ?? "created_at", cutoff);
  return count ?? 0;
}

/** Thrown mid-run so the caller keeps the count of rows already removed. */
class PartialDeleteError extends Error {
  constructor(message: string, readonly deleted: number) { super(message); }
}

/** PostgREST / Postgres "no such table": the migration that adds it is not applied yet. */
function isMissingTable(message: string): boolean {
  return /does not exist|could not find the table|schema cache/i.test(message);
}

/**
 * Remove the Storage objects owned by `ids` (see DeleteStep.storage). Problems
 * are reported, not thrown: the row delete is the compliance-critical part and
 * still runs, but an orphaned file must show up in the run log.
 */
async function removeStorageFor(sb: Sb, spec: StorageCleanup, ids: string[], errors: string[]): Promise<void> {
  let paths: string[];
  try {
    type Row = Record<string, string | null>;
    const rows = await fetchAllPages<Row>((from, to) =>
      sb.from(spec.table).select(`id, ${spec.pathCol}`).in(spec.fkCol, ids).order("id").range(from, to) as unknown as PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
      }>,
    );
    paths = rows.map((r) => r[spec.pathCol]).filter((p): p is string => !!p);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "read failed";
    if (!isMissingTable(msg)) errors.push(`${spec.table}: storage paths not read (${msg}); files may be orphaned in ${spec.bucket}`);
    return;
  }
  for (const batch of chunkIds(paths, 100)) {
    const { error } = await sb.storage.from(spec.bucket).remove(batch);
    if (error) errors.push(`${spec.bucket}: ${batch.length} file(s) not removed (${error.message})`);
  }
}

async function runDelete(sb: Sb, step: DeleteStep, cutoff: string, dryRun: boolean, errors: string[]): Promise<number> {
  if (dryRun) return countStep(sb, step, cutoff);

  const rows = await fetchAllPages<{ id: string }>((from, to) =>
    applyMatch(sb.from(step.table).select("id"), step.match, step.matchNull)
      .lt(step.tsCol ?? "created_at", cutoff)
      .order("id")
      .range(from, to),
  );
  const ids = rows.map((r) => r.id);

  let deleted = 0;
  for (const chunk of chunkIds(ids)) {
    if (step.storage) await removeStorageFor(sb, step.storage, chunk, errors);
    const del = await sb.from(step.table).delete().in("id", chunk).select("id");
    // Report what WAS removed alongside the failure: reporting 0 while N rows
    // are already gone would make the run log untrustworthy exactly when it
    // matters most.
    if (del.error) throw new PartialDeleteError(`${step.table}: ${del.error.message}`, deleted);
    deleted += del.data?.length ?? chunk.length;
  }
  return deleted;
}

async function runAnonymise(sb: Sb, step: AnonymiseStep, cutoff: string, dryRun: boolean): Promise<number> {
  const tsCol = step.tsCol ?? "redeemed_at";
  if (dryRun) {
    const { count } = await sb
      .from(step.table)
      .select("id", { count: "exact", head: true })
      .lt(tsCol, cutoff)
      .neq("redeemer_email", PURGED);
    return count ?? 0;
  }
  const res = await sb
    .from(step.table)
    // NOT NULL columns take the sentinel; nullable forensic columns are cleared.
    .update({ redeemer_name: PURGED, redeemer_email: PURGED, company_name: PURGED, ip: null, user_agent: null })
    .lt(tsCol, cutoff)
    // Skip rows already anonymised, so re-runs report honest counts.
    .neq("redeemer_email", PURGED)
    .select("id");
  if (res.error) throw new Error(`${step.table}: ${res.error.message}`);
  return res.data?.length ?? 0;
}

async function runSweep(sb: Sb, step: SweepStep, dryRun: boolean): Promise<number> {
  const col = step.expiresCol ?? "expires_at";
  const now = new Date().toISOString();
  if (dryRun) {
    const base = sb.from(step.table).select("id", { count: "exact", head: true });
    const { count } = await applyMatch(base, step.match).lt(col, now);
    return count ?? 0;
  }
  const res = await applyMatch(sb.from(step.table).delete(), step.match).lt(col, now).select("id");
  if (res.error) throw new Error(`${step.table}: ${res.error.message}`);
  return res.data?.length ?? 0;
}

/**
 * Run (or, with dryRun, merely measure) the retention policy for one service.
 * Never throws: a failing step is recorded in `errors` and the rest continue.
 */
export async function runRetentionForService(
  spec: RetentionSpec,
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<RetentionOutcome> {
  const sb = createServiceClient();
  const cutoff = retentionCutoffIso(opts.now);
  const dryRun = opts.dryRun ?? false;
  const out: RetentionOutcome = { key: spec.key, label: spec.label, deleted: 0, anonymised: 0, swept: 0, errors: [] };

  for (const step of spec.deletes ?? []) {
    try { out.deleted += await runDelete(sb, step, cutoff, dryRun, out.errors); }
    catch (e) {
      if (e instanceof PartialDeleteError) out.deleted += e.deleted;
      out.errors.push(e instanceof Error ? e.message : `${step.table}: delete failed`);
    }
  }
  for (const step of spec.anonymise ?? []) {
    try { out.anonymised += await runAnonymise(sb, step, cutoff, dryRun); }
    catch (e) { out.errors.push(e instanceof Error ? e.message : `${step.table}: anonymize failed`); }
  }
  for (const step of spec.sweeps ?? []) {
    try { out.swept += await runSweep(sb, step, dryRun); }
    catch (e) { out.errors.push(e instanceof Error ? e.message : `${step.table}: sweep failed`); }
  }
  return out;
}

/** Run the policy across every service. Used by the scheduled cron. */
export async function runRetentionForAll(
  specs: RetentionSpec[],
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<RetentionOutcome[]> {
  const results: RetentionOutcome[] = [];
  for (const spec of specs) results.push(await runRetentionForService(spec, opts));
  return results;
}
