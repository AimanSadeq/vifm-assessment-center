/**
 * Shared validation-evidence trail type.
 *
 * This is the same shape used by ARC (ara_questions.validation_evidence,
 * see src/types/ara.ts → AraQuestionValidationEvidence and migration
 * 00028) and now the Assessment Center (competencies.validation_evidence,
 * migration 00068). It anchors a measured construct (an ARC item or an AC
 * competency) to one or more published instruments / literature and tracks
 * human review of AI-suggested citations.
 *
 * The `review_status` field is the hallucination guard: only `verified` or
 * `edited` anchors are ever surfaced in a client-facing deliverable -
 * `ai_proposed` anchors stay internal until a human signs off.
 */
export type EvidenceConfidence = "direct_adaptation" | "construct_aligned" | "novel";

export type EvidenceReviewStatus = "ai_proposed" | "verified" | "edited" | "rejected";

export type EvidenceAnchorInstrument = {
  /** Common name of the instrument or framework, e.g. "Spencer & Spencer competency model". */
  name: string;
  /** Full bibliographic citation (APA-style preferred). */
  citation: string;
  /** Optional DOI for click-through verification. */
  doi?: string | null;
  /** Strength of the alignment between this construct and the anchor. */
  confidence: EvidenceConfidence;
  /** One-sentence rationale shown in the admin lineage card. */
  rationale: string;
};

export type ValidationEvidence = {
  /** One or more published instruments this construct content-aligns with. */
  anchor_instruments: EvidenceAnchorInstrument[];
  /** Short label of the broader construct, e.g. "Results orientation - achievement drive". */
  construct_summary: string;
  /** Gate that decides whether this evidence shows in a client-facing report. */
  review_status: EvidenceReviewStatus;
  /** Email of the human who last reviewed the evidence (null until reviewed). */
  reviewed_by: string | null;
  /** ISO timestamp of the last human review (null until reviewed). */
  reviewed_at: string | null;
  /** Model id when the anchors were AI-proposed (null for hand-authored). */
  ai_model: string | null;
};
