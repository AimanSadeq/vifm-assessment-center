import type { ValidationEvidence } from "@/types/evidence";
import {
  buildSystemPrompt, buildUserPrompt, relevantMenu, runEvidenceSuggester,
  type AnchorMenuEntry,
} from "./evidence-suggester-core";

/**
 * Validation-evidence suggester for the Fluent (English) reading /
 * listening item bank. Anchors an item's skill + CEFR band to the
 * language-testing / CEFR validity literature from a closed menu.
 */

export type FluentEvidenceInput = {
  /** "reading" | "listening" */
  skill: string;
  /** CEFR band, e.g. "B1" (may be null before calibration). */
  cefr: string | null;
};

const MENU: AnchorMenuEntry[] = [
  // ── Frameworks & general language-testing validity ──
  { tags: ["*"], name: "Common European Framework of Reference (CEFR)",
    citation: "Council of Europe (2001). Common European Framework of Reference for Languages: Learning, teaching, assessment. Cambridge University Press." },
  { tags: ["*"], name: "CEFR Companion Volume",
    citation: "Council of Europe (2020). Common European Framework of Reference for Languages: Learning, teaching, assessment — Companion volume. Council of Europe Publishing." },
  { tags: ["*"], name: "Developing common reference levels (North)",
    citation: "North, B. (2000). The development of a common framework scale of language proficiency. Peter Lang." },
  { tags: ["*"], name: "Fundamental Considerations in Language Testing (Bachman)",
    citation: "Bachman, L. F. (1990). Fundamental considerations in language testing. Oxford University Press." },
  { tags: ["*"], name: "Language Assessment in Practice (Bachman & Palmer)",
    citation: "Bachman, L. F., & Palmer, A. S. (2010). Language assessment in practice. Oxford University Press." },
  { tags: ["*"], name: "Language Testing and Validation (Weir)",
    citation: "Weir, C. J. (2005). Language testing and validation: An evidence-based approach. Palgrave Macmillan." },
  { tags: ["*"], name: "Validity (Messick)",
    citation: "Messick, S. (1989). Validity. In R. L. Linn (Ed.), Educational measurement (3rd ed., pp. 13–103). Macmillan." },
  { tags: ["*"], name: "Measuring Second Language Performance (McNamara)",
    citation: "McNamara, T. F. (1996). Measuring second language performance. Longman." },
  { tags: ["*"], name: "Standards for Educational and Psychological Testing",
    citation: "American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). Standards for educational and psychological testing. AERA." },

  // ── Reading ──
  { tags: ["READING"], name: "Assessing Reading (Alderson)",
    citation: "Alderson, J. C. (2000). Assessing reading. Cambridge University Press." },
  { tags: ["READING"], name: "Examining Reading (Khalifa & Weir)",
    citation: "Khalifa, H., & Weir, C. J. (2009). Examining reading: Research and practice in assessing second language reading. Cambridge University Press." },

  // ── Listening ──
  { tags: ["LISTENING"], name: "Assessing Listening (Buck)",
    citation: "Buck, G. (2001). Assessing listening. Cambridge University Press." },
  { tags: ["LISTENING"], name: "Cognitive validity of listening (Field)",
    citation: "Field, J. (2013). Cognitive validity. In A. Geranpayeh & L. Taylor (Eds.), Examining listening (pp. 77–151). Cambridge University Press." },
];

export async function suggestFluentValidationEvidence(
  input: FluentEvidenceInput
): Promise<ValidationEvidence | null> {
  const skill = (input.skill || "").toUpperCase();
  const menu = relevantMenu(MENU, [skill]);
  const user = buildUserPrompt({
    contextLines: [
      { k: "Instrument", v: "Fluent (English) proficiency — adaptive reading/listening test" },
      { k: "Skill", v: input.skill || "(unspecified)" },
      { k: "CEFR band", v: input.cefr || "(not yet calibrated)" },
    ],
    menu,
    constructHint: "English reading comprehension at CEFR B1",
  });
  return runEvidenceSuggester({
    system: buildSystemPrompt(
      "a language-testing expert advising VIFM on content-validity evidence for an English (CEFR-aligned) proficiency test"
    ),
    user,
    menu,
    constructFallback: `English ${input.skill || "language"} proficiency${input.cefr ? ` (${input.cefr})` : ""}`,
    tag: "fluent-evidence",
  });
}
