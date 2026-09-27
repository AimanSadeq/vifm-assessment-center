// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the shape of the VIFM behavioural
// competency framework.
//
// The authoritative DATA lives in the `competencies` / `competency_clusters`
// / domains tables. Framework v2 (migration 00226) is active: 21 competencies
// across 8 clusters and 4 domains, consolidated from the v1 41 (see
// src/lib/competencies/framework-v2.ts). Retired v1 rows are kept for
// history (retired_at set), never deleted.
//
// These constants MIRROR that seeded shape so every service shows the same
// numbers without hardcoding them. If the seeded framework changes, update the
// numbers HERE (one place) and the whole platform follows.
// ─────────────────────────────────────────────────────────────

/** Behavioural domains: THINKING · RESULTS · PEOPLE · SELF. */
export const FRAMEWORK_DOMAIN_COUNT = 4;
/** Competency clusters in the active framework (v2: Adaptability & Change retired). */
export const FRAMEWORK_CLUSTER_COUNT = 8;
/** Behavioural competencies in the active framework (the assessed units). */
export const COMPETENCY_COUNT = 21;

/** "21 competencies" - the count phrase, used across services (EN). */
export const COMPETENCY_COUNT_LABEL = `${COMPETENCY_COUNT} competencies` as const;

/** "4 domains, 8 clusters, 21 competencies" - the full framework shape (EN). */
export const FRAMEWORK_SHAPE_LABEL =
  `${FRAMEWORK_DOMAIN_COUNT} domains, ${FRAMEWORK_CLUSTER_COUNT} clusters, ${COMPETENCY_COUNT} competencies` as const;
