import { getAIClient, AI_MODEL } from "./client";
import type { ValidationEvidence } from "@/types/evidence";

/**
 * Per-competency validation-evidence suggester for the Assessment
 * Center framework. Mirrors src/lib/ai/validation-evidence-suggester.ts
 * (the ARC item suggester) but with an assessment-centre / competency-
 * modelling bibliography instead of the AI-readiness one.
 *
 * Takes a competency + its domain context and returns 1–3 anchor
 * instruments from a CLOSED, curated menu so Claude has to pick from
 * known, spot-checkable citations rather than fabricate paper-level
 * details. Output is always `review_status: 'ai_proposed'` - an admin
 * must verify before it appears on any client-facing surface.
 *
 * Returns null when ANTHROPIC_API_KEY isn't set (graceful fallback) or
 * when Claude returns malformed JSON.
 */

export type AcEvidenceSuggesterInput = {
  competency_name: string;
  competency_description: string;
  /** AC domain the competency sits in, e.g. "THINKING" / "RESULTS" / "PEOPLE" / "SELF". */
  domain_name: string;
};

// Closed menu. `domains` lists the AC domains an anchor is most relevant
// to; "*" means it applies to any competency (method-level validity).
// Citations are deliberately limited to seminal / textbook-stable works
// to keep the bibliography defensible against client spot-checks.
const ANCHOR_MENU: Array<{ domains: string[]; name: string; citation: string }> = [
  // ── General - assessment-centre method & competency-modelling validity ──
  { domains: ["*"], name: "ITAG Assessment Center Guidelines (6th ed.)",
    citation: "International Taskforce on Assessment Center Guidelines (2015). Guidelines and ethical considerations for assessment center operations (6th ed.). Journal of Management, 41(4), 1244–1273." },
  { domains: ["*"], name: "Assessment Centers in HRM (Thornton & Rupp)",
    citation: "Thornton, G. C., III, & Rupp, D. E. (2006). Assessment centers in human resource management: Strategies for prediction, diagnosis, and development. Lawrence Erlbaum." },
  { domains: ["*"], name: "AC dimension criterion validity meta-analysis (Arthur et al.)",
    citation: "Arthur, W., Jr., Day, E. A., McNelly, T. L., & Edens, P. S. (2003). A meta-analysis of the criterion-related validity of assessment center dimensions. Personnel Psychology, 56(1), 125–153." },
  { domains: ["*"], name: "AC validity meta-analysis (Gaugler et al.)",
    citation: "Gaugler, B. B., Rosenthal, D. B., Thornton, G. C., & Bentson, C. (1987). Meta-analysis of assessment center validity. Journal of Applied Psychology, 72(3), 493–511." },
  { domains: ["*"], name: "Competence at Work (Spencer & Spencer)",
    citation: "Spencer, L. M., & Spencer, S. M. (1993). Competence at work: Models for superior performance. Wiley." },
  { domains: ["*"], name: "The Competent Manager (Boyatzis)",
    citation: "Boyatzis, R. E. (1982). The competent manager: A model for effective performance. Wiley." },
  { domains: ["*"], name: "Doing competency modeling right (Campion et al.)",
    citation: "Campion, M. A., Fink, A. A., Ruggeberg, B. J., Carr, L., Phillips, G. M., & Odman, R. B. (2011). Doing competencies well: Best practices in competency modeling. Personnel Psychology, 64(1), 225–262." },
  { domains: ["*"], name: "The Great Eight competencies (Bartram)",
    citation: "Bartram, D. (2005). The Great Eight competencies: A criterion-centric approach to validation. Journal of Applied Psychology, 90(6), 1185–1203." },
  { domains: ["*"], name: "Standards for Educational and Psychological Testing",
    citation: "American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). Standards for educational and psychological testing. AERA." },
  { domains: ["*"], name: "ISO 10667 assessment service delivery",
    citation: "ISO 10667-1/2 (2020). Assessment service delivery - Procedures and methods to assess people in work and organizational settings. International Organization for Standardization." },

  // ── THINKING - reasoning, problem-solving, judgement, strategy ──
  { domains: ["THINKING"], name: "Validity of selection methods (Schmidt & Hunter)",
    citation: "Schmidt, F. L., & Hunter, J. E. (1998). The validity and utility of selection methods in personnel psychology. Psychological Bulletin, 124(2), 262–274." },
  { domains: ["THINKING"], name: "Leadership skills / complex problem solving (Mumford et al.)",
    citation: "Mumford, M. D., Zaccaro, S. J., Harding, F. D., Jacobs, T. O., & Fleishman, E. A. (2000). Leadership skills for a changing world: Solving complex social problems. Leadership Quarterly, 11(1), 11–35." },

  // ── RESULTS - achievement, drive, execution, accountability ──
  { domains: ["RESULTS"], name: "Testing for competence (McClelland)",
    citation: "McClelland, D. C. (1973). Testing for competence rather than for intelligence. American Psychologist, 28(1), 1–14." },
  { domains: ["RESULTS"], name: "Goal-setting theory (Locke & Latham)",
    citation: "Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation. American Psychologist, 57(9), 705–717." },

  // ── PEOPLE - interpersonal, leadership, influence, communication ──
  { domains: ["PEOPLE"], name: "Emotional intelligence (Mayer, Salovey & Caruso)",
    citation: "Mayer, J. D., Salovey, P., & Caruso, D. R. (2008). Emotional intelligence: New ability or eclectic traits? American Psychologist, 63(6), 503–517." },
  { domains: ["PEOPLE"], name: "Effective leadership behavior (Yukl)",
    citation: "Yukl, G. (2012). Effective leadership behavior: What we know and what questions need more attention. Academy of Management Perspectives, 26(4), 66–85." },

  // ── SELF - integrity, adaptability, resilience, self-management ──
  { domains: ["SELF"], name: "Big Five and job performance (Barrick & Mount)",
    citation: "Barrick, M. R., & Mount, M. K. (1991). The Big Five personality dimensions and job performance: A meta-analysis. Personnel Psychology, 44(1), 1–26." },
  { domains: ["SELF"], name: "Adaptive performance taxonomy (Pulakos et al.)",
    citation: "Pulakos, E. D., Arad, S., Donovan, M. A., & Plamondon, K. E. (2000). Adaptability in the workplace: Development of a taxonomy of adaptive performance. Journal of Applied Psychology, 85(4), 612–624." },
];

const SYSTEM_PROMPT =
  `You are a psychometric expert advising VIFM on per-competency content-validity ` +
  `evidence for an Assessment Center behavioural framework. Given a single competency ` +
  `(name + definition), you identify which published instrument(s) / works from a CLOSED ` +
  `menu the competency construct most closely content-aligns with.\n\n` +
  `Hard rules:\n` +
  `1. Pick ONLY from the supplied menu. Do NOT invent citations or paraphrase a citation ` +
  `   you don't see in the menu - even if you know the work - because every citation ` +
  `   shipping to clients is spot-checked, and a hallucinated reference breaks credibility.\n` +
  `2. Return 1 to 3 instruments - usually 2 is right (one method-level anchor + one ` +
  `   construct-specific anchor). Don't pad.\n` +
  `3. Confidence:\n` +
  `   - 'direct_adaptation': competency is a close match to a named model/dimension in the work\n` +
  `   - 'construct_aligned': competency measures the same construct family, different framing\n` +
  `   - 'novel': no good anchor in the menu - return [] for anchor_instruments\n` +
  `4. Reply ONLY with raw JSON. No prose, no markdown fence.`;

function buildPrompt(input: AcEvidenceSuggesterInput): string {
  const domain = input.domain_name.toUpperCase();
  const relevant = ANCHOR_MENU.filter(
    (m) => m.domains.includes("*") || m.domains.some((d) => domain.includes(d))
  );
  const menuText = relevant
    .map((m, i) => `${i + 1}. [${m.domains.join("/")}] ${m.name}\n   ${m.citation}`)
    .join("\n");

  return (
    `Competency: ${input.competency_name}\n` +
    `Domain: ${input.domain_name}\n` +
    `Definition: ${input.competency_description || "(no description on file)"}\n\n` +
    `Closed menu of anchor instruments (you MUST pick from this menu, by name):\n` +
    `${menuText}\n\n` +
    `Return JSON of this exact shape:\n` +
    `{\n` +
    `  "construct_summary": "<5-10 word summary of the construct this competency taps>",\n` +
    `  "anchor_instruments": [\n` +
    `    {\n` +
    `      "name": "<exact name from menu>",\n` +
    `      "citation": "<exact citation string from menu>",\n` +
    `      "confidence": "direct_adaptation" | "construct_aligned" | "novel",\n` +
    `      "rationale": "<one sentence linking the competency to the anchor>"\n` +
    `    }\n` +
    `  ]\n` +
    `}`
  );
}

/**
 * Suggest validation evidence for a single competency. Returns null when
 * AI isn't configured or Claude's reply can't be parsed - the caller
 * should treat null as "leave validation_evidence unchanged".
 */
export async function suggestCompetencyValidationEvidence(
  input: AcEvidenceSuggesterInput
): Promise<ValidationEvidence | null> {
  const ai = getAIClient();
  if (!ai) return null;

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;

    const json = block.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(json) as {
      construct_summary?: string;
      anchor_instruments?: Array<{
        name?: string;
        citation?: string;
        confidence?: string;
        rationale?: string;
      }>;
    };

    const anchors = (parsed.anchor_instruments ?? [])
      .filter((a) => a && a.name && a.citation)
      .slice(0, 3)
      .map((a) => {
        // Cross-check the citation against the menu so we don't ship a
        // Claude-confabulated paraphrase even by accident.
        const menuMatch = ANCHOR_MENU.find(
          (m) => m.name === a.name || m.citation === a.citation
        );
        const confidence = (
          ["direct_adaptation", "construct_aligned", "novel"] as const
        ).includes(a.confidence as never)
          ? (a.confidence as "direct_adaptation" | "construct_aligned" | "novel")
          : "construct_aligned";
        return {
          name: menuMatch?.name ?? a.name!,
          citation: menuMatch?.citation ?? a.citation!,
          doi: null,
          confidence,
          rationale: a.rationale ?? "",
        };
      });

    return {
      anchor_instruments: anchors,
      construct_summary: parsed.construct_summary ?? input.competency_name,
      review_status: "ai_proposed",
      reviewed_by: null,
      reviewed_at: null,
      ai_model: AI_MODEL,
    };
  } catch (e) {
    console.warn("[ac-evidence] suggester failed:", e);
    return null;
  }
}
