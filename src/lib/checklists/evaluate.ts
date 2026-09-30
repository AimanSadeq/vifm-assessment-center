/**
 * Combine a checklist definition, the platform's facts and people's ticks into
 * one status. Pure, so the engagement panel, the overview page and the PDF all
 * agree.
 *
 * An automatic item is done when the record says so. A person may also tick an
 * automatic item that the record cannot see (evidence held outside Caliber);
 * that counts, but it is shown as a manual tick so a reviewer can tell the two
 * apart.
 */

import { PHASES, PHASE_LABEL, type ChecklistDef, type ChecklistFacts, type ChecklistManualRow, type ChecklistStatus, type ChecklistItemStatus } from "./types";

export function evaluateChecklist(def: ChecklistDef, facts: ChecklistFacts, manual: ChecklistManualRow[], subjectId = ""): ChecklistStatus {
  const ticks = new Map(manual.filter((m) => m.done_at).map((m) => [m.item_key, m]));
  const notes = new Map(manual.filter((m) => m.note).map((m) => [m.item_key, m.note]));
  const items: ChecklistItemStatus[] = def.items
    .filter((it) => !it.when || it.when(facts))
    .map((it) => {
      const fact = it.auto ? facts[it.auto] : undefined;
      const tick = ticks.get(it.key);
      const autoDone = Boolean(fact?.done);
      const done = autoDone || Boolean(tick);
      const { link, when: _when, ...plain } = it;
      void _when;
      return {
        ...plain,
        href: link ? link(subjectId) : null,
        done,
        source: autoDone ? "auto" : tick ? "manual" : null,
        detail: fact?.detail ?? null,
        doneAt: autoDone ? null : tick?.done_at ?? null,
        doneBy: autoDone ? null : tick?.done_by_name ?? null,
        note: notes.get(it.key) ?? null,
      };
    });
  const phases = PHASES.map((phase) => {
    const phaseItems = items.filter((i) => i.phase === phase);
    return { phase, label: PHASE_LABEL[phase], items: phaseItems, done: phaseItems.filter((i) => i.done).length, total: phaseItems.length };
  }).filter((p) => p.total > 0);
  const done = items.filter((i) => i.done).length;
  const currentPhase = phases.find((p) => p.done < p.total)?.phase ?? null;
  return { service: def.service, phases, done, total: items.length, currentPhase };
}
