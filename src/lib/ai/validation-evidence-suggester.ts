import { getAIClient, AI_MODEL } from "./client";
import type { AraQuestionValidationEvidence } from "@/types/ara";

/**
 * Per-item validation-evidence suggester.
 *
 * Takes a question and its construct context, returns 1–3 anchor
 * instruments from the curated bibliography in
 * docs/ARA-Methodology-Brief.md §6. The bibliography is inlined into
 * the prompt as a closed menu so Claude has to pick from known,
 * spot-checkable citations rather than fabricate paper-level details.
 *
 * The output is always set to `review_status: 'ai_proposed'` - the
 * admin must verify before it appears in any client-facing surface.
 *
 * Returns null when ANTHROPIC_API_KEY isn't set (graceful fallback)
 * or when Claude returns malformed JSON.
 */

export type ValidationSuggesterInput = {
  question_text_en: string;
  /** Either a pillar id (org-side) or an individual factor id. */
  construct_id: string;
  /** Friendly name of the construct, e.g. "AI Sense-Check" or "Strategy". */
  construct_name: string;
  /** Construct definition the question is supposed to measure. */
  construct_description: string;
};

// Closed menu - every entry mirrors a citation in
// docs/ARA-Methodology-Brief.md §6. Edit there first, then mirror here
// (and rerun any AI suggestions). Keeping these in sync is a manual
// discipline; long-term a shared TS export would be cleaner.
const ANCHOR_MENU = [
  // ── Individual / four factors ─────────────────────────────────
  { construct: "AI Sense-Check", name: "AI Literacy framework (Long & Magerko)",
    citation: "Long, D., & Magerko, B. (2020). What is AI literacy? Competencies and design considerations. CHI 2020." },
  { construct: "AI Sense-Check", name: "AI Literacy review (Ng et al.)",
    citation: "Ng, D. T. K., Leung, J. K. L., Chu, S. K. W., & Qiao, M. S. (2021). Conceptualizing AI literacy: An exploratory review. Computers and Education: AI, 2, 100041." },
  { construct: "AI Working Practice", name: "Technology Acceptance Model (TAM)",
    citation: "Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user acceptance of information technology. MIS Quarterly, 13(3), 319–340." },
  { construct: "AI Working Practice", name: "Unified Theory of Acceptance and Use of Technology (UTAUT)",
    citation: "Venkatesh, V., Morris, M. G., Davis, G. B., & Davis, F. D. (2003). User acceptance of information technology: Toward a unified view. MIS Quarterly, 27(3), 425–478." },
  { construct: "AI Working Practice", name: "Generative AI productivity outcomes (Brynjolfsson et al.)",
    citation: "Brynjolfsson, E., Li, D., & Raymond, L. R. (2025). Generative AI at work. Quarterly Journal of Economics." },
  { construct: "AI Collaboration", name: "UTAUT2 - social influence",
    citation: "Venkatesh, V., Thong, J. Y. L., & Xu, X. (2012). Consumer acceptance and use of information technology: Extending UTAUT (UTAUT2). MIS Quarterly, 36(1), 157–178." },
  { construct: "AI Collaboration", name: "Communities of Practice (Wenger)",
    citation: "Wenger, E. (1998). Communities of practice: Learning, meaning, and identity. Cambridge University Press." },
  { construct: "AI Adaptive Mindset", name: "Technology Readiness Index 2.0",
    citation: "Parasuraman, A., & Colby, C. L. (2015). An updated and streamlined Technology Readiness Index: TRI 2.0. Journal of Service Research, 18(1), 59–74." },
  { construct: "AI Adaptive Mindset", name: "Growth-mindset theory (Dweck)",
    citation: "Dweck, C. S. (2006). Mindset: The new psychology of success. Random House." },

  // ── Organisational / eight pillars ────────────────────────────
  // The `construct` keys here MUST match the pillar.name_en values
  // in src/lib/constants/ara-pillars.ts so the menu-filter in
  // buildPrompt() finds the right anchors.
  { construct: "Strategy & Vision", name: "AI for the real world (Davenport & Ronanki)",
    citation: "Davenport, T. H., & Ronanki, R. (2018). Artificial intelligence for the real world. Harvard Business Review, 96(1), 108–116." },
  { construct: "Strategy & Vision", name: "Competing in the age of AI (Iansiti & Lakhani)",
    citation: "Iansiti, M., & Lakhani, K. R. (2020). Competing in the age of AI. Harvard Business Review Press." },
  { construct: "Data Foundations", name: "DAMA-DMBOK",
    citation: "DAMA International (2017). DAMA-DMBOK: Data Management Body of Knowledge (2nd ed.). Technics Publications." },
  { construct: "Data Foundations", name: "EDM Council DCAM",
    citation: "EDM Council (2020). Data Management Capability Assessment Model (DCAM)." },
  { construct: "Technology & Infrastructure", name: "Hidden technical debt in ML (Sculley et al.)",
    citation: "Sculley, D., Holt, G., Golovin, D., et al. (2015). Hidden technical debt in machine learning systems. NeurIPS 28, 2503–2511." },
  { construct: "Technology & Infrastructure", name: "Software engineering challenges for ML (Lwakatare et al.)",
    citation: "Lwakatare, L. E., Raj, A., Bosch, J., Olsson, H. H., & Crnkovic, I. (2019). A taxonomy of software engineering challenges for ML systems. XP 2019." },
  { construct: "Talent & Skills", name: "WEF Future of Jobs Report",
    citation: "World Economic Forum (2025). Future of Jobs Report 2025." },
  { construct: "Talent & Skills", name: "OECD AI / data governance",
    citation: "OECD (2024). AI, data governance and privacy: Synergies and areas of international co-operation." },
  { construct: "Culture & Change Readiness", name: "Leading Digital (Westerman et al.)",
    citation: "Westerman, G., Bonnet, D., & McAfee, A. (2014). Leading Digital: Turning Technology into Business Transformation. HBR Press." },
  { construct: "Culture & Change Readiness", name: "Radical innovation across nations (Tellis et al.)",
    citation: "Tellis, G. J., Prabhu, J. C., & Chandy, R. K. (2009). Radical innovation across nations: The preeminence of corporate culture. Journal of Marketing, 73(1), 3–23." },
  { construct: "Governance, Ethics & Compliance", name: "NIST AI RMF 1.0",
    citation: "National Institute of Standards and Technology (2023). AI Risk Management Framework 1.0 (AI RMF 1.0). NIST AI 100-1." },
  { construct: "Governance, Ethics & Compliance", name: "ISO/IEC 42001:2023",
    citation: "ISO/IEC 42001:2023. Information technology - Artificial intelligence - Management system. ISO." },
  { construct: "Operations & Use Case Portfolio", name: "CMMI for Services",
    citation: "Software Engineering Institute, Carnegie Mellon (2010). CMMI for Services, Version 1.3." },
  { construct: "Operations & Use Case Portfolio", name: "Accelerate / DORA metrics",
    citation: "Forsgren, N., Humble, J., & Kim, G. (2018). Accelerate: The Science of Lean Software and DevOps. IT Revolution Press." },
  { construct: "Model Management & Monitoring", name: "ML Test Score (Breck et al.)",
    citation: "Breck, E., Cai, S., Nielsen, E., Salib, M., & Sculley, D. (2017). The ML test score: A rubric for ML production readiness. IEEE Big Data, 1123–1132." },
  { construct: "Model Management & Monitoring", name: "Model Cards (Mitchell et al.)",
    citation: "Mitchell, M., Wu, S., Zaldivar, A., et al. (2019). Model cards for model reporting. FAT* 2019, 220–229." },
];

const SYSTEM_PROMPT =
  `You are a psychometric expert advising VIFM on per-item content-validity evidence ` +
  `for the AI Readiness Compass. Given a single Likert / rating item, you identify which ` +
  `published instrument(s) from a CLOSED menu the item most closely content-aligns with. ` +
  `\n\n` +
  `Hard rules:\n` +
  `1. Pick ONLY from the supplied menu. Do NOT invent citations or paraphrase a citation ` +
  `   you don't see in the menu - even if you know the work - because every citation ` +
  `   shipping to clients is spot-checked, and a hallucinated DOI breaks credibility.\n` +
  `2. Return 1 to 3 instruments - usually 1 or 2 is right. Don't pad.\n` +
  `3. Confidence:\n` +
  `   - 'direct_adaptation': item is a close paraphrase of a published scale item\n` +
  `   - 'construct_aligned': item measures the same construct, different wording\n` +
  `   - 'novel': no good anchor in the menu - return [] for anchor_instruments and confidence='novel' on a placeholder entry with name='No close anchor in curated menu'\n` +
  `4. Reply ONLY with raw JSON. No prose, no markdown fence.`;

function buildPrompt(input: ValidationSuggesterInput): string {
  const relevantMenu = ANCHOR_MENU
    .filter((m) => m.construct === input.construct_name)
    .concat(ANCHOR_MENU.filter((m) => m.construct !== input.construct_name).slice(0, 6));

  const menuText = relevantMenu
    .map((m, i) => `${i + 1}. [${m.construct}] ${m.name}\n   ${m.citation}`)
    .join("\n");

  return (
    `Construct: ${input.construct_name}\n` +
    `Construct definition: ${input.construct_description}\n\n` +
    `Item text:\n"""\n${input.question_text_en}\n"""\n\n` +
    `Closed menu of anchor instruments (you MUST pick from this menu, by name):\n` +
    `${menuText}\n\n` +
    `Return JSON of this exact shape:\n` +
    `{\n` +
    `  "construct_summary": "<5–10 word summary of the construct this item taps>",\n` +
    `  "anchor_instruments": [\n` +
    `    {\n` +
    `      "name": "<exact name from menu>",\n` +
    `      "citation": "<exact citation string from menu>",\n` +
    `      "confidence": "direct_adaptation" | "construct_aligned" | "novel",\n` +
    `      "rationale": "<one sentence linking the item to the construct>"\n` +
    `    }\n` +
    `  ]\n` +
    `}`
  );
}

/**
 * Suggest validation evidence for a single question. Returns null when
 * AI isn't configured or Claude's reply can't be parsed - the caller
 * should treat null as "leave validation_evidence unchanged".
 */
export async function suggestValidationEvidence(
  input: ValidationSuggesterInput
): Promise<AraQuestionValidationEvidence | null> {
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
        // Cross-check the citation against the menu so we don't ship
        // a Claude-confabulated paraphrase even by accident.
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
          confidence,
          rationale: a.rationale ?? "",
        };
      });

    return {
      anchor_instruments: anchors,
      construct_summary: parsed.construct_summary ?? input.construct_name,
      review_status: "ai_proposed",
      reviewed_by: null,
      reviewed_at: null,
      ai_model: AI_MODEL,
    };
  } catch (e) {
    console.warn("[validation-evidence] suggester failed:", e);
    return null;
  }
}
