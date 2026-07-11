// Shared pagination for ARA reads that can exceed the PostgREST max-rows cap.
//
// Hosted Supabase silently truncates any single select at 1000 rows - it is a
// LIMIT, not an error - so an unpaginated "load all responses" read computes
// scores/means from a partial cohort with no visible failure (the same defect
// class as the Persona D360 incident). Every reader whose row count scales
// with cohort size (responses, redemptions, respondents-in-bulk) must page.
//
// Usage: the caller builds the query per page and MUST apply a deterministic
// .order() (e.g. .order("id")) so pages never skip or duplicate rows:
//
//   const rows = await fetchAllPages<Row>((from, to) =>
//     sb.from("ara_responses").select("...").eq("assessment_id", id)
//       .order("id").range(from, to)
//   );
//
// Stops on the first short page. Throws on a query error rather than returning
// partial data - callers decide whether to catch (dashboards degrade) or abort
// (score recalculation must never persist partial results).

const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** Split an id list into chunks so a PostgREST `in(...)` URL stays sane. */
export function chunkIds<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Fetch every row whose id (or foreign key) is in `ids`, chunking the id list so
 * the PostgREST in(...) URL stays sane AND paginating within each chunk so a
 * chunk that itself exceeds 1000 matching rows is not truncated. `page` receives
 * the id chunk plus the row range and must apply a deterministic .order().
 *
 *   const rows = await fetchAllByIdChunks<Row>(engIds, (chunk, from, to) =>
 *     sb.from("consensus_ratings").select("...").in("engagement_id", chunk)
 *       .order("id").range(from, to));
 */
export async function fetchAllByIdChunks<T>(
  ids: string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
  chunkSize = 200,
): Promise<T[]> {
  const out: T[] = [];
  for (const chunk of chunkIds(ids, chunkSize)) {
    if (chunk.length === 0) continue;
    const rows = await fetchAllPages<T>((from, to) => page(chunk, from, to));
    out.push(...rows);
  }
  return out;
}
