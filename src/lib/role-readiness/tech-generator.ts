// AI generator for Role Readiness technical-knowledge questions. Given a role +
// a technical area, Claude drafts MCQ items (4 options, one correct). The admin
// reviews/edits them in the editor like any authored item. Returns null when no
// API key is configured (the admin can still author questions manually).

import { getAIClient, AI_MODEL } from "@/lib/ai/client";

export type GeneratedTechItem = { stem: string; options: string[]; correctIndex: number };

export async function generateTechnicalItems(input: {
  roleName: string;
  areaName: string;
  count?: number;
}): Promise<GeneratedTechItem[] | null> {
  const ai = getAIClient();
  if (!ai) return null;
  const n = Math.min(10, Math.max(1, input.count ?? 4));

  const system =
    "You write multiple-choice technical-knowledge questions for VIFM role-readiness assessments. " +
    "Each question tests practical, role-relevant knowledge in the named technical area. " +
    "Exactly 4 options, exactly one correct. Keep stems clear and unambiguous; make distractors plausible. " +
    "Do NOT reveal which option is correct in the text.";
  const user =
    `Role: ${input.roleName}\n` +
    `Technical area: ${input.areaName}\n\n` +
    `Write ${n} multiple-choice questions for this area. Return ONLY a JSON array (no markdown fences, no preamble):\n` +
    `[{ "stem": "<question>", "options": ["<a>","<b>","<c>","<d>"], "correctIndex": <0-3> }]`;

  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const match = block.text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as Array<{ stem?: unknown; options?: unknown; correctIndex?: unknown }>;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((q) => {
        const stem = typeof q.stem === "string" ? q.stem.trim() : "";
        const options = Array.isArray(q.options)
          ? q.options.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean)
          : [];
        const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : -1;
        return { stem, options, correctIndex };
      })
      .filter((q) => q.stem.length >= 3 && q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length)
      .slice(0, n);
  } catch (err) {
    console.error("[rr tech-generator] failed:", err);
    return null;
  }
}
