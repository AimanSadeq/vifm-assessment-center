"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import {
  setBlockReviewStatus,
  updateBlockContent,
  type BlockContentUpdate,
} from "@/lib/technical-sandbox/service";

const VALID = ["draft", "in_review", "approved", "rejected", "retired"] as const;
type ReviewStatus = (typeof VALID)[number];

export async function setBlockReviewStatusAction(
  blockId: string,
  reviewStatus: ReviewStatus,
): Promise<{ ok: boolean; error?: string }> {
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized" };
    throw e;
  }
  if (!VALID.includes(reviewStatus)) return { ok: false, error: "Invalid status" };
  const reviewerName = caller.isDev
    ? "VIFM (dev)"
    : caller.uid
      ? `Admin ${caller.uid.slice(0, 8)}`
      : "VIFM reviewer";
  const res = await setBlockReviewStatus(blockId, reviewStatus, reviewerName);
  if (res.ok) revalidatePath("/admin/tech-sandbox/sandbox-blocks");
  return res;
}

// ── Sandbox-task content editor ────────────────────────────────────
// Edit a task's prompt / instructions / master answer (master_solution) /
// expected output + scoring checkpoints in place, instead of only changing its
// review status. Admin-gated; the jsonb fields arrive as raw JSON strings and
// are parsed + shape-checked here before the DB write.

/** Shape the editor client sends - text fields + the three jsonb-as-string fields. */
export type BlockContentFormInput = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  frameworkRef: string;
  promptEn: string;
  promptAr: string;
  instructionsEn: string;
  instructionsAr: string;
  timeLimitSeconds: number;
  engineConfigJson: string;
  masterSolutionJson: string;
  checkpointsJson: string;
};

const contentSchema = z.object({
  nameEn: z.string().trim().min(1, "Name (EN) is required").max(300),
  nameAr: z.string().max(300),
  descriptionEn: z.string().max(4000),
  descriptionAr: z.string().max(4000),
  frameworkRef: z.string().max(200),
  promptEn: z.string().max(8000),
  promptAr: z.string().max(8000),
  instructionsEn: z.string().max(8000),
  instructionsAr: z.string().max(8000),
  timeLimitSeconds: z.coerce.number().int().min(30).max(36000),
  engineConfigJson: z.string(),
  masterSolutionJson: z.string(),
  checkpointsJson: z.string(),
});

function parseJson(
  label: string,
  raw: string,
  emptyDefault: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: emptyDefault };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch (e) {
    return { ok: false, error: `${label}: invalid JSON (${e instanceof Error ? e.message : "parse error"})` };
  }
}

export async function updateBlockContentAction(
  blockId: string,
  input: BlockContentFormInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized" };
    throw e;
  }
  if (!blockId || typeof blockId !== "string") return { ok: false, error: "Missing task id" };

  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const ec = parseJson("Engine config", d.engineConfigJson, {});
  if (!ec.ok) return ec;
  const ms = parseJson("Master answer", d.masterSolutionJson, {});
  if (!ms.ok) return ms;
  const cp = parseJson("Checkpoints", d.checkpointsJson, []);
  if (!cp.ok) return cp;

  // Light shape checks so a mistyped value can't corrupt the scoring engine.
  if (!Array.isArray(cp.value)) return { ok: false, error: "Checkpoints must be a JSON array" };
  if (typeof ms.value !== "object" || ms.value === null || Array.isArray(ms.value)) {
    return { ok: false, error: "Master answer must be a JSON object" };
  }
  if (typeof ec.value !== "object" || ec.value === null || Array.isArray(ec.value)) {
    return { ok: false, error: "Engine config must be a JSON object" };
  }

  const blank = (s: string) => (s.trim() === "" ? null : s);
  const content: BlockContentUpdate = {
    name_en: d.nameEn.trim(),
    name_ar: blank(d.nameAr),
    description_en: blank(d.descriptionEn),
    description_ar: blank(d.descriptionAr),
    framework_ref: blank(d.frameworkRef),
    prompt_en: blank(d.promptEn),
    prompt_ar: blank(d.promptAr),
    instructions_en: blank(d.instructionsEn),
    instructions_ar: blank(d.instructionsAr),
    time_limit_seconds: d.timeLimitSeconds,
    engine_config: ec.value,
    master_solution: ms.value,
    checkpoints: cp.value,
  };

  const res = await updateBlockContent(blockId, content);
  if (res.ok) revalidatePath("/admin/tech-sandbox/sandbox-blocks");
  return res;
}
