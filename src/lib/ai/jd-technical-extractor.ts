import type Anthropic from "@anthropic-ai/sdk";
import { getAIClient, AI_MODEL } from "./client";
import { TECH_FUNCTION_CATEGORIES } from "@/lib/competencies/technical-function";

// ── JD → technical function blueprint ────────────────────────────────────────
//
// The Phase-2 generative extractor: read a finance job description and propose a
// FUNCTION BLUEPRINT — the technical skills that function is assessed on. Unlike
// the behavioural JD-competency extractor (which only picks from a fixed menu),
// this is generative: it MATCHES the supplied technical skill library where it
// can (so item banks are reused) but may also PROPOSE new skills the JD requires
// that aren't in the library yet. Output drives the admin review → create-custom-
// function flow. Mirrors jd-competency-extractor's text + PDF entry points.

export type JdMatchedSkill = { skill: string; weight: number; rationale: string };
export type JdProposedSkill = { name: string; description: string; weight: number; rationale: string };
export type JdFunctionBlueprint = {
  suggestedName: string;
  suggestedCategory: string;
  matched: JdMatchedSkill[];
  proposed: JdProposedSkill[];
};

type TextInput = { jobDescription: string; skillLibrary: string[]; targetRole?: string };
type PdfInput = { pdfBase64: string; skillLibrary: string[]; targetRole?: string };

const CATEGORIES = new Set<string>(TECH_FUNCTION_CATEGORIES);

const SYSTEM_PROMPT =
  `You are a technical-competency designer for VIFM (Virginia Institute of Finance and ` +
  `Management), a GCC finance & management institute. Given a finance job description, you ` +
  `produce a FUNCTION BLUEPRINT: the hard, functional technical skills this job/function is ` +
  `assessed on (e.g. "Invoice Processing & 3-Way Match", "FX Risk Management"). You PREFER ` +
  `matching the supplied skill library so item banks are reused, and you PROPOSE a new skill ` +
  `only when the JD genuinely requires a technical skill not in the library. You may receive ` +
  `English or Arabic job descriptions; respond in English. Focus on technical skills, NOT ` +
  `behavioural traits (leadership, communication) — those are assessed separately.`;

function buildInstructions(skillLibrary: string[], targetRole: string | undefined, jdInline: string | null) {
  const menu = skillLibrary.map((s) => `- ${s}`).join("\n");
  return (
    `Target role: ${targetRole?.trim() || "(not specified - infer from JD)"}\n\n` +
    (jdInline
      ? `Job description:\n"""\n${jdInline.trim()}\n"""\n\n`
      : `The job description is provided as the attached PDF document. Read it in full first.\n\n`) +
    `SKILL LIBRARY (match these EXACT names where the JD requires the skill):\n${menu}\n\n` +
    `CATEGORIES (pick the single best fit): ${TECH_FUNCTION_CATEGORIES.join(" | ")}\n\n` +
    `Return ONLY JSON (no markdown fences, no preamble), matching:\n` +
    `{\n` +
    `  "suggestedName": "<concise function name, e.g. 'Accounts Payable Specialist'>",\n` +
    `  "suggestedCategory": "<one category from the list above>",\n` +
    `  "matched": [ { "skill": "<EXACT name from the library>", "weight": <1-3>, "rationale": "<1 sentence: which JD requirement maps here>" } ],\n` +
    `  "proposed": [ { "name": "<new skill name, Title Case>", "description": "<1 sentence>", "weight": <1-3>, "rationale": "<why the JD needs a NEW skill>" } ]\n` +
    `}\n\n` +
    `Rules: 5-8 skills TOTAL across matched + proposed. Strongly prefer matched over proposed. ` +
    `Weight: 3 = core to the role, 2 = strong, 1 = supporting. Do not duplicate a library skill in "proposed".`
  );
}

export async function extractTechnicalSkillsFromJd(input: TextInput): Promise<JdFunctionBlueprint | null> {
  const ai = getAIClient();
  if (!ai) return null;
  if (!input.jobDescription.trim() || input.skillLibrary.length === 0) return null;
  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildInstructions(input.skillLibrary, input.targetRole, input.jobDescription) }],
    });
    return parseBlueprint(res, input.skillLibrary);
  } catch (err) {
    console.error("[jd-tech-extract] failed:", err);
    return null;
  }
}

export async function extractTechnicalSkillsFromJdPdf(input: PdfInput): Promise<JdFunctionBlueprint | null> {
  const ai = getAIClient();
  if (!ai) return null;
  if (!input.pdfBase64 || input.skillLibrary.length === 0) return null;
  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: input.pdfBase64 } },
            { type: "text" as const, text: buildInstructions(input.skillLibrary, input.targetRole, null) },
          ],
        },
      ],
    });
    return parseBlueprint(res, input.skillLibrary);
  } catch (err) {
    console.error("[jd-tech-extract:pdf] failed:", err);
    return null;
  }
}

const clampWeight = (w: unknown): number => {
  const n = typeof w === "number" ? w : Number(w);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(3, Math.round(n)));
};

function parseBlueprint(response: Anthropic.Messages.Message, skillLibrary: string[]): JdFunctionBlueprint | null {
  try {
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const jsonText = block.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<JdFunctionBlueprint>;

    const libSet = new Set(skillLibrary);
    const seen = new Set<string>();
    const matched: JdMatchedSkill[] = (parsed.matched ?? [])
      .filter((m): m is JdMatchedSkill => typeof m?.skill === "string" && libSet.has(m.skill))
      .filter((m) => (seen.has(m.skill) ? false : (seen.add(m.skill), true)))
      .map((m) => ({ skill: m.skill, weight: clampWeight(m.weight), rationale: typeof m.rationale === "string" ? m.rationale : "" }));

    const proposed: JdProposedSkill[] = (parsed.proposed ?? [])
      .filter((p): p is JdProposedSkill => typeof p?.name === "string" && p.name.trim().length > 0)
      // Never let a "proposed" skill duplicate a library skill (or another proposal).
      .filter((p) => !libSet.has(p.name) && !seen.has(p.name) && (seen.add(p.name), true))
      .map((p) => ({
        name: p.name.trim(),
        description: typeof p.description === "string" ? p.description : "",
        weight: clampWeight(p.weight),
        rationale: typeof p.rationale === "string" ? p.rationale : "",
      }));

    if (matched.length + proposed.length === 0) return null;

    const suggestedCategory =
      typeof parsed.suggestedCategory === "string" && CATEGORIES.has(parsed.suggestedCategory)
        ? parsed.suggestedCategory
        : "accounting";

    return {
      suggestedName: (typeof parsed.suggestedName === "string" && parsed.suggestedName.trim()) || "Custom Function",
      suggestedCategory,
      matched,
      proposed,
    };
  } catch (err) {
    console.error("[jd-tech-extract] parse failed:", err);
    return null;
  }
}

/**
 * Best-effort Arabic translation of a finalized function name + its skills, for
 * a custom (JD-derived) function. Returns index-aligned arrays; null on failure
 * or when AI is unavailable (the loader then falls back to English in AR mode).
 */
export async function translateFunctionToArabic(input: {
  name: string;
  skills: string[];
}): Promise<{ name_ar: string | null; skills_ar: string[] | null }> {
  const ai = getAIClient();
  if (!ai || input.skills.length === 0) return { name_ar: null, skills_ar: null };
  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 1200,
      system:
        `You translate finance function + skill names into clear Modern Standard Arabic for GCC ` +
        `finance professionals. Keep standard acronyms (IFRS, VAT, DSO, COSO, ISA, GOSI, WPS) as ` +
        `written. Return ONLY JSON.`,
      messages: [
        {
          role: "user",
          content:
            `Translate to Arabic. Return ONLY JSON: { "name_ar": "...", "skills_ar": ["...", ...] } ` +
            `where skills_ar is index-aligned with the input skills.\n\n` +
            `name: ${input.name}\nskills:\n${input.skills.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { name_ar: null, skills_ar: null };
    const m = block.text.match(/\{[\s\S]*\}/);
    if (!m) return { name_ar: null, skills_ar: null };
    const parsed = JSON.parse(m[0]) as { name_ar?: string; skills_ar?: string[] };
    const skills_ar =
      Array.isArray(parsed.skills_ar) && parsed.skills_ar.length === input.skills.length
        ? parsed.skills_ar.map((s) => String(s))
        : null;
    return { name_ar: typeof parsed.name_ar === "string" ? parsed.name_ar : null, skills_ar };
  } catch (err) {
    console.error("[jd-tech-extract] arabic translate failed:", err);
    return { name_ar: null, skills_ar: null };
  }
}
