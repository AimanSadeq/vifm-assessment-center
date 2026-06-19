// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the shape of the VIFM behavioural
// competency framework.
//
// The authoritative DATA lives in the `competencies` / `competency_clusters`
// / domains tables: seed migration 00002 created 4 domains / 8 clusters / 38
// competencies, and migration 00100 added a 9th cluster ("Customer &
// Stakeholder Focus") plus competencies 39-41. The Persona behavioural item
// bank (behavioral-items.ts) carries the matching 41 via deterministic UUIDs.
//
// These constants MIRROR that seeded shape so every service shows the same
// numbers without hardcoding them. If the seeded framework changes, update the
// numbers HERE (one place) and the whole platform follows.
// ─────────────────────────────────────────────────────────────

/** Behavioural domains: THINKING · RESULTS · PEOPLE · SELF. */
export const FRAMEWORK_DOMAIN_COUNT = 4;
/** Competency clusters (8 original + the 9th, Customer & Stakeholder Focus). */
export const FRAMEWORK_CLUSTER_COUNT = 9;
/** Behavioural competencies across all clusters (the assessed units). */
export const COMPETENCY_COUNT = 41;

/** "41 competencies" - the count phrase, used across services (EN). */
export const COMPETENCY_COUNT_LABEL = `${COMPETENCY_COUNT} competencies` as const;

/** "4 domains, 9 clusters, 41 competencies" - the full framework shape (EN). */
export const FRAMEWORK_SHAPE_LABEL =
  `${FRAMEWORK_DOMAIN_COUNT} domains, ${FRAMEWORK_CLUSTER_COUNT} clusters, ${COMPETENCY_COUNT} competencies` as const;
