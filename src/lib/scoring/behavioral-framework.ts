// Behavioural framework versioning for the code-side Persona bank.
//
// behavioral-items.ts is generated and holds every competency ever served,
// with its items. That full list stays the lookup for REPORTS, so a completed
// sitting on an older framework still renders its competencies. NEW sittings
// and design pickers read ACTIVE_BEHAVIORAL_COMPETENCIES instead.
//
// A competency is retired by adding it to BEHAVIORAL_SUPERSEDED_BY, pointing
// at the competency that absorbed it - the code twin of
// competencies.superseded_by (migration 00225). Both change together on the
// day a new framework version goes live. It now holds the v1 -> v2 mapping
// (framework-v2.ts), so the active list is the 21.

import { BEHAVIORAL_COMPETENCIES, type BehavioralCompetency } from "@/lib/scoring/behavioral-items";
import { V1_TO_V2, V2_FRAMEWORK_VERSION, V2_RETIRED_WITHOUT_SUCCESSOR } from "@/lib/competencies/framework-v2";

/** The framework version the code bank serves (competency_framework_versions.version). */
export const BEHAVIORAL_FRAMEWORK_VERSION = V2_FRAMEWORK_VERSION;

/** Retired competency id -> the competency id that absorbed it (v1 -> v2). */
export const BEHAVIORAL_SUPERSEDED_BY: Readonly<Record<string, string>> = V1_TO_V2;

/** Retired with no behavioural successor (moved to the Technical pillar). */
export const BEHAVIORAL_RETIRED_WITHOUT_SUCCESSOR: ReadonlySet<string> = new Set(V2_RETIRED_WITHOUT_SUCCESSOR);

/** Competencies offered to new sittings and design pickers: the active framework. */
export const ACTIVE_BEHAVIORAL_COMPETENCIES: BehavioralCompetency[] = BEHAVIORAL_COMPETENCIES.filter(
  (c) => !(c.acCompetencyId in BEHAVIORAL_SUPERSEDED_BY) && !BEHAVIORAL_RETIRED_WITHOUT_SUCCESSOR.has(c.acCompetencyId),
);

/** Follow the supersession chain to the competency that is live today. An id
 *  that was never retired comes back unchanged. Guards against a cycle. */
export function successorOf(id: string, map: Readonly<Record<string, string>> = BEHAVIORAL_SUPERSEDED_BY): string {
  let cur = id;
  for (let i = 0; i < 10; i++) {
    const next = map[cur];
    if (!next || next === cur) return cur;
    cur = next;
  }
  return cur;
}

/** Translate a stored scope (voucher, bundle, requisition, session) onto the
 *  live framework: each retired id becomes its successor, duplicates collapse.
 *  Order is kept (first occurrence wins). A scope that named one half of a
 *  merged pair widens to the merged competency; one that named both shrinks
 *  in count - never silently to nothing. */
export function translateCompetencyIds(
  ids: readonly string[],
  map: Readonly<Record<string, string>> = BEHAVIORAL_SUPERSEDED_BY,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const s = successorOf(id, map);
    // A competency retired with no successor has left the framework: drop it.
    if (map === BEHAVIORAL_SUPERSEDED_BY && BEHAVIORAL_RETIRED_WITHOUT_SUCCESSOR.has(s)) continue;
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
