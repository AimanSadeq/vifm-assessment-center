/**
 * Engagement checklists: one per service, tracked per client engagement.
 *
 * The point is that nobody has to remember the process. Each service has a
 * master list of what must be true before the agreement, in the agreement, at
 * set-up, during delivery and at close, with an owner for every item. Where
 * Caliber already knows the answer (the purpose is set, the pack is published,
 * the report is generated) the item ticks itself; the rest are ticked by a
 * person, with their name, the date and a note.
 *
 * A checklist row is never the source of truth for a fact the platform holds:
 * an automatic item reads the record, so it cannot go stale by mistake.
 */

export type ChecklistService = "ac" | "arc";

export type ChecklistOwner = "bd" | "consultant" | "admin" | "client";

export const OWNER_LABEL: Record<ChecklistOwner, string> = {
  bd: "Business development",
  consultant: "Consultant",
  admin: "Admin",
  client: "Client",
};

export type ChecklistPhase = "before" | "agreement" | "setup" | "delivery" | "close";

export const PHASE_LABEL: Record<ChecklistPhase, string> = {
  before: "Before the agreement",
  agreement: "The agreement",
  setup: "Set-up",
  delivery: "Delivery",
  close: "Reporting and close",
};

export const PHASES: ChecklistPhase[] = ["before", "agreement", "setup", "delivery", "close"];

export type ChecklistItemDef = {
  key: string;
  phase: ChecklistPhase;
  label: string;
  owner: ChecklistOwner;
  /** One line on what "done" means or where to do it. */
  hint?: string;
  /** Read from the record; when set, the item ticks itself. */
  auto?: string;
  /** Show only when the engagement matches (e.g. selection centres). */
  when?: (facts: ChecklistFacts) => boolean;
  /** Relative link to the place where the item is done. */
  link?: (subjectId: string) => string;
};

export type ChecklistDef = {
  service: ChecklistService;
  serviceLabel: string;
  items: ChecklistItemDef[];
};

/** What the platform knows: one entry per `auto` key. */
export type ChecklistFact = { done: boolean; detail?: string };
export type ChecklistFacts = Record<string, ChecklistFact>;

/** A person's tick, from service_checklist_items. */
export type ChecklistManualRow = {
  item_key: string;
  done_at: string | null;
  done_by_name: string | null;
  note: string | null;
};

/** Plain data only (no functions), so it can cross to client components. */
export type ChecklistItemStatus = Omit<ChecklistItemDef, "link" | "when"> & {
  href: string | null;
  done: boolean;
  /** "auto" when the record says so, "manual" when a person ticked it. */
  source: "auto" | "manual" | null;
  detail: string | null;
  doneAt: string | null;
  doneBy: string | null;
  note: string | null;
};

export type ChecklistPhaseStatus = {
  phase: ChecklistPhase;
  label: string;
  items: ChecklistItemStatus[];
  done: number;
  total: number;
};

export type ChecklistStatus = {
  service: ChecklistService;
  phases: ChecklistPhaseStatus[];
  done: number;
  total: number;
  /** The first phase with an open item, or null when everything is done. */
  currentPhase: ChecklistPhase | null;
};
