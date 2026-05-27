/**
 * Academy lesson keys. A "lesson" is one section of a course's outline_en
 * (the canonical structure; outline_ar is rendered alongside by the same
 * index). The key is index-prefixed so it is unique even when two sections
 * share a title or a title has no Latin characters (Arabic-only), and the
 * index is always recoverable for resolution + ordering.
 *
 * Both the course-consumption page (which renders the lesson nav links) and
 * the lesson page (which resolves the key back to an outline section) import
 * these helpers, so the slug stays consistent across the two.
 */

export function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Stable, unique lesson key for an outline section at a given index. */
export function lessonKeyFor(title: string, index: number): string {
  return `${index}-${slugify(title) || "lesson"}`;
}

/** Recover the outline index from a lesson key (-1 if malformed). */
export function indexFromLessonKey(key: string): number {
  const m = (key || "").match(/^(\d+)-/);
  return m ? parseInt(m[1], 10) : -1;
}
