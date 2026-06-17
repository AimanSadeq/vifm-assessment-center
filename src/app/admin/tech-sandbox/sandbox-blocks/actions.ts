"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { setBlockReviewStatus } from "@/lib/technical-sandbox/service";

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
