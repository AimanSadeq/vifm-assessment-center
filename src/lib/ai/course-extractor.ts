import type Anthropic from "@anthropic-ai/sdk";
import { getAIClient, AI_MODEL } from "./client";
import type {
  Competency,
  VifmCourseLevel,
  VifmCourseOutlineSection,
  VifmVertical,
} from "@/types/database";

// One row per PDF processed. Tags are *proposals* — admin reviews and
// accepts before they hit vifm_course_competency_tags / pillar_tags.
export type ExtractedCoursePayload = {
  // Identity
  title_en: string;
  title_ar: string | null;
  code: string | null;
  vertical: VifmVertical;
  level: VifmCourseLevel;
  certification_code: string | null;

  // Duration band
  default_duration_days: number;
  min_duration_days: number;
  max_duration_days: number;

  // Six blocks
  overview_en: string | null;
  overview_ar: string | null;
  target_competencies_raw_en: string[];
  target_competencies_raw_ar: string[] | null;
  audience_en: string | null;
  audience_ar: string | null;
  objectives_en: string[];
  objectives_ar: string[] | null;
  methodology_en: string | null;
  methodology_ar: string | null;
  outline_en: VifmCourseOutlineSection[];
  outline_ar: VifmCourseOutlineSection[] | null;

  // Tag proposals
  competency_tags: Array<{
    competency_id: string;
    competency_name: string;
    relevance_weight: 1 | 2 | 3;
    rationale: string;
  }>;
  pillar_tags: Array<{
    pillar_id:
      | "strategy" | "data" | "technology" | "talent" | "culture"
      | "governance" | "operations" | "model_management";
    relevance_weight: 1 | 2 | 3;
    rationale: string;
  }>;

  // Confidence
  extraction_confidence: number;
};

const VERTICALS: VifmVertical[] = [
  "finance", "investment", "treasury", "accounting", "banking", "tax",
  "analytics", "business_intelligence", "artificial_intelligence",
  "business_reporting", "leadership", "strategy", "project_management",
  "real_estate",
];

const PILLAR_IDS: ExtractedCoursePayload["pillar_tags"][number]["pillar_id"][] = [
  "strategy", "data", "technology", "talent", "culture",
  "governance", "operations", "model_management",
];

const SYSTEM_PROMPT =
  `You are a curriculum analyst for VIFM (Virginia Institute of Finance and Management). ` +
  `VIFM delivers training courses across 14 verticals. Each course outline PDF you receive ` +
  `follows a fixed six-block structure: course overview, target competencies, target audience, ` +
  `course objectives, course methodology, detailed course outline. ` +
  `Your job: extract the structured catalogue record AND propose two sets of tags — ` +
  `(a) which AC behavioural competencies the course develops (from a supplied list), and ` +
  `(b) which ARA pillars the course addresses topically. ` +
  `You may receive English or Arabic outlines; preserve both languages in your output where present.`;

function buildInstructions(competencies: Competency[]): string {
  const competencyMenu = competencies
    .map((c) => `- ${c.name} [${c.id}]${c.description ? `: ${c.description}` : ""}`)
    .join("\n");

  return (
    `The attached PDF is a VIFM course outline.\n\n` +
    `── EXTRACTION TARGETS ──\n` +
    `Read all six blocks of the PDF, then return ONE JSON object (no markdown, no preamble) matching this schema:\n` +
    `{\n` +
    `  "title_en": "<course title in English>",\n` +
    `  "title_ar": "<course title in Arabic if present, else null>",\n` +
    `  "code": "<short code if present, e.g. 'CAIP', 'PMP', 'CAMS'; null if none>",\n` +
    `  "vertical": "<one of: ${VERTICALS.join(", ")}>",\n` +
    `  "level": "<foundation | intermediate | advanced — infer from title and objectives>",\n` +
    `  "certification_code": "<if course preps for an external certification e.g. PMI's PMP, ACAMS CAMS; null otherwise>",\n` +
    `  "default_duration_days": <number, infer from overview if mentioned (e.g. 'intensive 5-day course'); default 5 if unstated>,\n` +
    `  "min_duration_days": <number; default 2 — VIFM corporate/in-house can compress courses>,\n` +
    `  "max_duration_days": <number; default 5 — VIFM public delivery>,\n` +
    `  "overview_en": "<Block 1 verbatim, English>",\n` +
    `  "overview_ar": "<Block 1 verbatim, Arabic if present, else null>",\n` +
    `  "target_competencies_raw_en": ["<each bullet from Block 2 verbatim>", ...],\n` +
    `  "target_competencies_raw_ar": ["<Arabic block 2 if present, else null>", ...],\n` +
    `  "audience_en": "<Block 3 verbatim>",\n` +
    `  "audience_ar": "<null or Arabic>",\n` +
    `  "objectives_en": ["<each Block 4 bullet verbatim>", ...],\n` +
    `  "objectives_ar": null | ["..."],\n` +
    `  "methodology_en": "<Block 5 verbatim>",\n` +
    `  "methodology_ar": null | "...",\n` +
    `  "outline_en": [{ "title": "<section heading>", "bullets": ["<each sub-bullet>", ...] }, ...],\n` +
    `  "outline_ar": null | [...],\n` +
    `  "competency_tags": [\n` +
    `    { "competency_id": "<id from VIFM AC list below>",\n` +
    `      "competency_name": "<exact name from list>",\n` +
    `      "relevance_weight": <1=tangential, 2=related, 3=core>,\n` +
    `      "rationale": "<1 sentence: which block / outline section evidences this mapping>" },\n` +
    `    ... up to 6 tags total\n` +
    `  ],\n` +
    `  "pillar_tags": [\n` +
    `    { "pillar_id": "<one of: ${PILLAR_IDS.join(", ")}>",\n` +
    `      "relevance_weight": <1|2|3>,\n` +
    `      "rationale": "<1 sentence>" },\n` +
    `    ... up to 4 tags total\n` +
    `  ],\n` +
    `  "extraction_confidence": <0.0-1.0; how cleanly the PDF mapped to the 6-block structure>\n` +
    `}\n\n` +
    `── COMPETENCY TAGGING (BEHAVIOURAL AXIS) ──\n` +
    `These are VIFM's AC behavioural competencies (how a person works), NOT topical capabilities. ` +
    `Map a course to a competency only when the course materially develops that *behaviour*, not just ` +
    `when the topic is adjacent. Lean toward fewer, higher-confidence tags.\n` +
    `Available competencies:\n${competencyMenu}\n\n` +
    `── PILLAR TAGGING (TOPICAL AXIS) ──\n` +
    `These are ARA's 8 organisational AI-readiness pillars. Map a course to a pillar when the course ` +
    `topic builds organisational capability in that pillar. Examples: "Cyber Enabled Crime" → governance, ` +
    `data; "AI Strategy Professional" → strategy, governance; "AI-Powered Accountant" → operations, talent.\n\n` +
    `── HARD RULES ──\n` +
    `* Vertical must be exactly one of the 14 listed values. Use 'artificial_intelligence' for AI-focused courses, ` +
    `'banking' for banking-specific courses (not 'finance'), 'leadership' for leadership/management, etc.\n` +
    `* Preserve Arabic verbatim when present (don't translate).\n` +
    `* Do NOT invent tags — every competency_id must appear in the supplied list.\n` +
    `* Return ONLY the JSON object — no markdown fences, no commentary.\n`
  );
}

export async function extractCourseFromPdf(input: {
  pdfBase64: string;
  competencies: Competency[];
  filename?: string;
}): Promise<ExtractedCoursePayload | null> {
  const ai = getAIClient();
  if (!ai) return null;
  if (!input.pdfBase64 || input.competencies.length === 0) return null;

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: input.pdfBase64,
              },
            },
            {
              type: "text" as const,
              text: buildInstructions(input.competencies),
            },
          ],
        },
      ],
    });

    return parseExtraction(response, input.competencies);
  } catch (err) {
    console.error(`[course-extract] Failed${input.filename ? ` (${input.filename})` : ""}:`, err);
    return null;
  }
}

function parseExtraction(
  response: Anthropic.Messages.Message,
  competencies: Competency[]
): ExtractedCoursePayload | null {
  try {
    const block = response.content[0];
    if (block?.type !== "text") return null;

    const raw = block.text.trim();
    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(jsonText) as Partial<ExtractedCoursePayload> & {
      competency_tags?: ExtractedCoursePayload["competency_tags"];
      pillar_tags?: ExtractedCoursePayload["pillar_tags"];
    };

    // Sanity-check vertical
    const vertical = (parsed.vertical && (VERTICALS as string[]).includes(parsed.vertical))
      ? parsed.vertical
      : "leadership";

    // Sanity-check level
    const level: VifmCourseLevel =
      parsed.level === "foundation" || parsed.level === "advanced"
        ? parsed.level
        : "intermediate";

    // Filter competency tags against the real list — drops anything Claude
    // hallucinated. AC competency IDs are uuids, so an unknown id is a clear
    // signal to discard rather than coerce.
    const validCompIds = new Set(competencies.map((c) => c.id));
    const idToName = new Map(competencies.map((c) => [c.id, c.name]));
    const competencyTags = (parsed.competency_tags ?? [])
      .filter((t) =>
        typeof t?.competency_id === "string" &&
        validCompIds.has(t.competency_id) &&
        [1, 2, 3].includes(t.relevance_weight))
      .map((t) => ({
        ...t,
        competency_name: idToName.get(t.competency_id) ?? t.competency_name,
        rationale: typeof t.rationale === "string" ? t.rationale : "",
      }))
      .slice(0, 8);

    const validPillarIds = new Set(PILLAR_IDS);
    const pillarTags = (parsed.pillar_tags ?? [])
      .filter((t) =>
        validPillarIds.has(t.pillar_id) &&
        [1, 2, 3].includes(t.relevance_weight))
      .map((t) => ({
        ...t,
        rationale: typeof t.rationale === "string" ? t.rationale : "",
      }))
      .slice(0, 6);

    // Duration sanity: clamp to [0.5, 20] and enforce min ≤ default ≤ max
    const clamp = (n: unknown, fallback: number) => {
      const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
      return Math.max(0.5, Math.min(20, v));
    };
    const def = clamp(parsed.default_duration_days, 5);
    const minD = Math.min(clamp(parsed.min_duration_days, 2), def);
    const maxD = Math.max(clamp(parsed.max_duration_days, 5), def);

    return {
      title_en: typeof parsed.title_en === "string" ? parsed.title_en : "Untitled course",
      title_ar: typeof parsed.title_ar === "string" ? parsed.title_ar : null,
      code: typeof parsed.code === "string" && parsed.code.length <= 40 ? parsed.code : null,
      vertical: vertical as VifmVertical,
      level,
      certification_code: typeof parsed.certification_code === "string" ? parsed.certification_code : null,
      default_duration_days: def,
      min_duration_days: minD,
      max_duration_days: maxD,
      overview_en: typeof parsed.overview_en === "string" ? parsed.overview_en : null,
      overview_ar: typeof parsed.overview_ar === "string" ? parsed.overview_ar : null,
      target_competencies_raw_en: Array.isArray(parsed.target_competencies_raw_en)
        ? parsed.target_competencies_raw_en.map(String)
        : [],
      target_competencies_raw_ar: Array.isArray(parsed.target_competencies_raw_ar)
        ? parsed.target_competencies_raw_ar.map(String)
        : null,
      audience_en: typeof parsed.audience_en === "string" ? parsed.audience_en : null,
      audience_ar: typeof parsed.audience_ar === "string" ? parsed.audience_ar : null,
      objectives_en: Array.isArray(parsed.objectives_en)
        ? parsed.objectives_en.map(String)
        : [],
      objectives_ar: Array.isArray(parsed.objectives_ar)
        ? parsed.objectives_ar.map(String)
        : null,
      methodology_en: typeof parsed.methodology_en === "string" ? parsed.methodology_en : null,
      methodology_ar: typeof parsed.methodology_ar === "string" ? parsed.methodology_ar : null,
      outline_en: Array.isArray(parsed.outline_en) ? parsed.outline_en as VifmCourseOutlineSection[] : [],
      outline_ar: Array.isArray(parsed.outline_ar) ? parsed.outline_ar as VifmCourseOutlineSection[] : null,
      competency_tags: competencyTags,
      pillar_tags: pillarTags,
      extraction_confidence:
        typeof parsed.extraction_confidence === "number"
          ? Math.max(0, Math.min(1, parsed.extraction_confidence))
          : 0.7,
    };
  } catch (err) {
    console.error("[course-extract] parse failed:", err);
    return null;
  }
}
