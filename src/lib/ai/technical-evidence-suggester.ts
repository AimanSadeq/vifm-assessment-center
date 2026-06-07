import type { ValidationEvidence } from "@/types/evidence";
import {
  buildSystemPrompt, buildUserPrompt, relevantMenu, runEvidenceSuggester,
  type AnchorMenuEntry,
} from "./evidence-suggester-core";

/**
 * Validation-evidence suggester for the Technical Certification item
 * bank. Anchors a job-knowledge item (domain + skill) to the
 * content-validity, standard-setting and credentialing literature.
 */

export type TechnicalEvidenceInput = {
  domain_key: string;
  skill: string;
  /** First ~140 chars of the question stem, for construct context. */
  question_excerpt?: string;
};

const MENU: AnchorMenuEntry[] = [
  // ── Content validity & job analysis (the core defensibility for a knowledge test) ──
  { tags: ["*"], name: "Content validity ratio (Lawshe)",
    citation: "Lawshe, C. H. (1975). A quantitative approach to content validity. Personnel Psychology, 28(4), 563–575." },
  { tags: ["*"], name: "Job analysis for licensure/certification (Raymond)",
    citation: "Raymond, M. R. (2001). Job analysis and the specification of content for licensure and certification examinations. Applied Measurement in Education, 14(4), 369–415." },
  { tags: ["*"], name: "Validity argument (Kane)",
    citation: "Kane, M. T. (2013). Validating the interpretations and uses of test scores. Journal of Educational Measurement, 50(1), 1–73." },
  { tags: ["*"], name: "Standards for Educational and Psychological Testing",
    citation: "American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). Standards for educational and psychological testing. AERA." },
  { tags: ["*"], name: "NCCA Standards for Certification Programs",
    citation: "National Commission for Certifying Agencies (2014). Standards for the accreditation of certification programs. Institute for Credentialing Excellence." },

  // ── Item writing & test construction ──
  { tags: ["*"], name: "Multiple-choice item-writing guidelines (Haladyna et al.)",
    citation: "Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A review of multiple-choice item-writing guidelines for classroom assessment. Applied Measurement in Education, 15(3), 309–333." },
  { tags: ["*"], name: "Introduction to Classical and Modern Test Theory (Crocker & Algina)",
    citation: "Crocker, L., & Algina, J. (1986). Introduction to classical and modern test theory. Holt, Rinehart & Winston." },
  { tags: ["*"], name: "Taxonomy of educational objectives (Anderson & Krathwohl)",
    citation: "Anderson, L. W., & Krathwohl, D. R. (Eds.) (2001). A taxonomy for learning, teaching, and assessing: A revision of Bloom's taxonomy of educational objectives. Longman." },

  // ── Standard setting / cut scores ──
  { tags: ["*"], name: "Standard Setting (Cizek & Bunch)",
    citation: "Cizek, G. J., & Bunch, M. B. (2007). Standard setting: A guide to establishing and evaluating performance standards on tests. Sage." },
  { tags: ["*"], name: "Scales, norms, and equivalent scores (Angoff)",
    citation: "Angoff, W. H. (1971). Scales, norms, and equivalent scores. In R. L. Thorndike (Ed.), Educational measurement (2nd ed., pp. 508–600). American Council on Education." },
];

export async function suggestTechnicalValidationEvidence(
  input: TechnicalEvidenceInput
): Promise<ValidationEvidence | null> {
  const menu = relevantMenu(MENU, [input.domain_key, input.skill]);
  const user = buildUserPrompt({
    contextLines: [
      { k: "Instrument", v: "Technical Certification — job-knowledge MCQ test" },
      { k: "Domain", v: input.domain_key || "(unspecified)" },
      { k: "Skill", v: input.skill || "(unspecified)" },
      { k: "Item stem", v: input.question_excerpt || "(not provided)" },
    ],
    menu,
    constructHint: "Job-knowledge proficiency in a technical domain",
  });
  return runEvidenceSuggester({
    system: buildSystemPrompt(
      "a psychometric/credentialing expert advising VIFM on content-validity and standard-setting evidence for a technical certification test"
    ),
    user,
    menu,
    constructFallback: `Technical job knowledge — ${input.domain_key || "domain"} / ${input.skill || "skill"}`,
    tag: "technical-evidence",
  });
}
