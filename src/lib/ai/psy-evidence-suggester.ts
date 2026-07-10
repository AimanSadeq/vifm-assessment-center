import type { ValidationEvidence } from "@/types/evidence";
import {
  buildSystemPrompt, buildUserPrompt, relevantMenu, runEvidenceSuggester,
  type AnchorMenuEntry,
} from "./evidence-suggester-core";

/**
 * Validation-evidence suggester for psychometric scales. Anchors a cognitive
 * (Logica) scale to the construct-validity, reliability and scale-development
 * literature from a closed menu.
 */

export type PsyEvidenceInput = {
  scale_name: string;
  /** "cognitive" */
  instrument_kind: string;
  instrument_name?: string;
};

const MENU: AnchorMenuEntry[] = [
  // ── Construct validity, reliability & scale development (general) ──
  { tags: ["*"], name: "Construct validity in psychological tests (Cronbach & Meehl)",
    citation: "Cronbach, L. J., & Meehl, P. E. (1955). Construct validity in psychological tests. Psychological Bulletin, 52(4), 281–302." },
  { tags: ["*"], name: "Coefficient alpha (Cronbach)",
    citation: "Cronbach, L. J. (1951). Coefficient alpha and the internal structure of tests. Psychometrika, 16(3), 297–334." },
  { tags: ["*"], name: "Validity of psychological assessment (Messick)",
    citation: "Messick, S. (1995). Validity of psychological assessment: Validation of inferences from persons' responses and performances as scientific inquiry into score meaning. American Psychologist, 50(9), 741–749." },
  { tags: ["*"], name: "Psychometric Theory (Nunnally & Bernstein)",
    citation: "Nunnally, J. C., & Bernstein, I. H. (1994). Psychometric theory (3rd ed.). McGraw-Hill." },
  { tags: ["*"], name: "Constructing validity: scale development (Clark & Watson)",
    citation: "Clark, L. A., & Watson, D. (1995). Constructing validity: Basic issues in objective scale development. Psychological Assessment, 7(3), 309–319." },
  { tags: ["*"], name: "Item Response Theory for Psychologists (Embretson & Reise)",
    citation: "Embretson, S. E., & Reise, S. P. (2000). Item response theory for psychologists. Lawrence Erlbaum." },
  { tags: ["*"], name: "Standards for Educational and Psychological Testing",
    citation: "American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). Standards for educational and psychological testing. AERA." },

  // ── Cognitive ──
  { tags: ["COGNITIVE"], name: "Human Cognitive Abilities (Carroll)",
    citation: "Carroll, J. B. (1993). Human cognitive abilities: A survey of factor-analytic studies. Cambridge University Press." },
  { tags: ["COGNITIVE"], name: "Validity and utility of selection methods (Schmidt & Hunter)",
    citation: "Schmidt, F. L., & Hunter, J. E. (1998). The validity and utility of selection methods in personnel psychology: Practical and theoretical implications of 85 years of research findings. Psychological Bulletin, 124(2), 262–274." },
];

export async function suggestPsyValidationEvidence(
  input: PsyEvidenceInput
): Promise<ValidationEvidence | null> {
  const menu = relevantMenu(MENU, [input.instrument_kind]);
  const user = buildUserPrompt({
    contextLines: [
      { k: "Instrument", v: input.instrument_name || "Psychometric instrument" },
      { k: "Type", v: input.instrument_kind || "(unspecified)" },
      { k: "Scale", v: input.scale_name || "(unspecified)" },
    ],
    menu,
    constructHint: "Inductive reasoning subtest of general mental ability",
  });
  return runEvidenceSuggester({
    system: buildSystemPrompt(
      "a psychometrician advising VIFM on construct-validity and reliability evidence for a psychological measurement scale"
    ),
    user,
    menu,
    constructFallback: input.scale_name || "psychometric scale",
    tag: "psy-evidence",
  });
}
