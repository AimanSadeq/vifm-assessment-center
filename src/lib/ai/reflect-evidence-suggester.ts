import type { ValidationEvidence } from "@/types/evidence";
import {
  buildSystemPrompt, buildUserPrompt, relevantMenu, runEvidenceSuggester,
  type AnchorMenuEntry,
} from "./evidence-suggester-core";

/**
 * Validation-evidence suggester for Reflect 360 competencies. Anchors a
 * multi-rater behavioural competency to the multisource-feedback,
 * rating-scale and competency-modelling literature.
 */

export type ReflectEvidenceInput = {
  competency_name: string;
  competency_description: string;
  framework_name: string;
};

const MENU: AnchorMenuEntry[] = [
  // ── Multisource (360) feedback method & psychometrics ──
  { tags: ["*"], name: "Handbook of Multisource Feedback (Bracken, Timmreck & Church)",
    citation: "Bracken, D. W., Timmreck, C. W., & Church, A. H. (Eds.) (2001). The handbook of multisource feedback. Jossey-Bass." },
  { tags: ["*"], name: "Psychometric properties of multisource ratings (Conway & Huffcutt)",
    citation: "Conway, J. M., & Huffcutt, A. I. (1997). Psychometric properties of multisource performance ratings: A meta-analysis of subordinate, supervisor, peer, and self-ratings. Human Performance, 10(4), 331–360." },
  { tags: ["*"], name: "Does performance improve following multisource feedback? (Smither et al.)",
    citation: "Smither, J. W., London, M., & Reilly, R. R. (2005). Does performance improve following multisource feedback? A theoretical model, meta-analysis, and review of empirical findings. Personnel Psychology, 58(1), 33–66." },
  { tags: ["*"], name: "Self–other rating agreement (Atwater & Yammarino)",
    citation: "Atwater, L. E., & Yammarino, F. J. (1992). Does self–other agreement on leadership perceptions moderate the validity of leadership and performance predictions? Personnel Psychology, 45(1), 141–164." },
  { tags: ["*"], name: "Feedback effectiveness (DeNisi & Kluger)",
    citation: "DeNisi, A. S., & Kluger, A. N. (2000). Feedback effectiveness: Can 360-degree appraisals be improved? Academy of Management Executive, 14(1), 129–139." },

  // ── Behavioural rating scales & rater accuracy ──
  { tags: ["*"], name: "Behaviorally anchored rating scales (Smith & Kendall)",
    citation: "Smith, P. C., & Kendall, L. M. (1963). Retranslation of expectations: An approach to the construction of unambiguous anchors for rating scales. Journal of Applied Psychology, 47(2), 149–155." },
  { tags: ["*"], name: "Rater training meta-analysis (Woehr & Huffcutt)",
    citation: "Woehr, D. J., & Huffcutt, A. I. (1994). Rater training for performance appraisal: A quantitative review. Journal of Occupational and Organizational Psychology, 67(3), 189–205." },
  { tags: ["*"], name: "Understanding Performance Appraisal (Murphy & Cleveland)",
    citation: "Murphy, K. R., & Cleveland, J. N. (1995). Understanding performance appraisal: Social, organizational, and goal-based perspectives. Sage." },

  // ── Competency modelling ──
  { tags: ["*"], name: "Doing competency modeling right (Campion et al.)",
    citation: "Campion, M. A., Fink, A. A., Ruggeberg, B. J., Carr, L., Phillips, G. M., & Odman, R. B. (2011). Doing competencies well: Best practices in competency modeling. Personnel Psychology, 64(1), 225–262." },
  { tags: ["*"], name: "The Great Eight competencies (Bartram)",
    citation: "Bartram, D. (2005). The Great Eight competencies: A criterion-centric approach to validation. Journal of Applied Psychology, 90(6), 1185–1203." },
  { tags: ["*"], name: "Standards for Educational and Psychological Testing",
    citation: "American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). Standards for educational and psychological testing. AERA." },
];

export async function suggestReflectValidationEvidence(
  input: ReflectEvidenceInput
): Promise<ValidationEvidence | null> {
  const menu = relevantMenu(MENU, ["*"]);
  const user = buildUserPrompt({
    contextLines: [
      { k: "Instrument", v: "Reflect 360 - multi-rater behavioural feedback" },
      { k: "Framework", v: input.framework_name || "(unspecified)" },
      { k: "Competency", v: input.competency_name || "(unspecified)" },
      { k: "Definition", v: input.competency_description || "(no description on file)" },
    ],
    menu,
    constructHint: "Leadership behaviour rated via multisource feedback",
  });
  return runEvidenceSuggester({
    system: buildSystemPrompt(
      "an industrial-organizational psychologist advising VIFM on validity evidence for a 360-degree multi-rater feedback instrument"
    ),
    user,
    menu,
    constructFallback: input.competency_name || "360 behavioural competency",
    tag: "reflect-evidence",
  });
}
