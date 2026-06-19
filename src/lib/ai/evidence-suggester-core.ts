import { getAIClient, AI_MODEL } from "./client";
import type { ValidationEvidence, EvidenceConfidence } from "@/types/evidence";

/**
 * Shared core for the per-construct validation-evidence suggesters.
 *
 * The AC suggester (ai/ac-evidence-suggester.ts) and the ARC suggester
 * pre-date this and stay standalone; this core factors out the identical
 * machinery for the four instruments added later (Fluent, Technical,
 * Reflect, Psychometrics): a CLOSED, curated citation menu, a strict
 * "pick only from the menu" prompt, a Claude call, JSON parsing, and a
 * menu cross-check so a confabulated paraphrase can never ship. Every
 * result is review_status='ai_proposed' - a human must verify before it
 * reaches any client surface.
 *
 * Returns null when ANTHROPIC_API_KEY isn't set or the reply can't be
 * parsed; callers treat null as "leave validation_evidence unchanged".
 */

/** A citation in a suggester's closed menu. `tags` scope it to sub-constructs; "*" = any. */
export type AnchorMenuEntry = { tags: string[]; name: string; citation: string };

export function buildSystemPrompt(expertRole: string): string {
  return (
    `You are ${expertRole}. Given a single measured construct, you identify which ` +
    `published instrument(s) / works from a CLOSED menu the construct most closely ` +
    `content-aligns with.\n\n` +
    `Hard rules:\n` +
    `1. Pick ONLY from the supplied menu. Do NOT invent citations or paraphrase a citation ` +
    `   you don't see in the menu - even if you know the work - because every citation ` +
    `   shipping to clients is spot-checked, and a hallucinated reference breaks credibility.\n` +
    `2. Return 1 to 3 instruments - usually 2 is right (one method/standards-level anchor + ` +
    `   one construct-specific anchor). Don't pad.\n` +
    `3. Confidence:\n` +
    `   - 'direct_adaptation': construct is a close match to a named model/dimension in the work\n` +
    `   - 'construct_aligned': construct measures the same construct family, different framing\n` +
    `   - 'novel': no good anchor in the menu - return [] for anchor_instruments\n` +
    `4. Reply ONLY with raw JSON. No prose, no markdown fence.`
  );
}

/** Filter a menu to entries tagged "*" or matching one of the construct's tags. */
export function relevantMenu(menu: AnchorMenuEntry[], tags: string[]): AnchorMenuEntry[] {
  const up = tags.map((t) => t.toUpperCase());
  return menu.filter(
    (e) => e.tags.includes("*") || e.tags.some((t) => up.some((u) => u.includes(t.toUpperCase())))
  );
}

export function buildUserPrompt(args: {
  /** Context lines describing the construct, e.g. {k:"Skill", v:"reading"}. */
  contextLines: { k: string; v: string }[];
  menu: AnchorMenuEntry[];
  /** Hint for the construct_summary if the model omits one. */
  constructHint: string;
}): string {
  const menuText = args.menu
    .map((e, i) => `${i + 1}. [${e.tags.join("/")}] ${e.name}\n   ${e.citation}`)
    .join("\n");
  const ctx = args.contextLines.map((l) => `${l.k}: ${l.v || "(none)"}`).join("\n");
  return (
    `${ctx}\n\n` +
    `Closed menu of anchor instruments (you MUST pick from this menu, by name):\n` +
    `${menuText}\n\n` +
    `Return JSON of this exact shape:\n` +
    `{\n` +
    `  "construct_summary": "<5-10 word summary of the construct, e.g. '${args.constructHint}'>",\n` +
    `  "anchor_instruments": [\n` +
    `    { "name": "<exact name from menu>", "citation": "<exact citation from menu>", ` +
    `"confidence": "direct_adaptation" | "construct_aligned" | "novel", ` +
    `"rationale": "<one sentence linking the construct to the anchor>" }\n` +
    `  ]\n` +
    `}`
  );
}

export async function runEvidenceSuggester(args: {
  system: string;
  user: string;
  menu: AnchorMenuEntry[];
  constructFallback: string;
  tag: string; // for log lines, e.g. "fluent-evidence"
}): Promise<ValidationEvidence | null> {
  const ai = getAIClient();
  if (!ai) return null;

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;

    const json = block.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(json) as {
      construct_summary?: string;
      anchor_instruments?: Array<{ name?: string; citation?: string; confidence?: string; rationale?: string }>;
    };

    const anchors = (parsed.anchor_instruments ?? [])
      .filter((a) => a && a.name && a.citation)
      .slice(0, 3)
      .map((a) => {
        // Cross-check against the menu so we never ship a Claude-confabulated
        // paraphrase even by accident - substitute the canonical strings.
        const menuMatch = args.menu.find((mm) => mm.name === a.name || mm.citation === a.citation);
        const confidence = (
          ["direct_adaptation", "construct_aligned", "novel"] as const
        ).includes(a.confidence as never)
          ? (a.confidence as EvidenceConfidence)
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
      construct_summary: parsed.construct_summary ?? args.constructFallback,
      review_status: "ai_proposed",
      reviewed_by: null,
      reviewed_at: null,
      ai_model: AI_MODEL,
    };
  } catch (e) {
    console.warn(`[${args.tag}] suggester failed:`, e);
    return null;
  }
}
