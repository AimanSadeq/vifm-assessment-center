"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { analyzeProctorSession } from "@/lib/proctor/analyze";
import type { ProctorReviewSummary } from "@/lib/proctor/access";

const SESSION_RE = /^[0-9a-fA-F-]{36}$/;

/** Admin-triggered AI vision review of a proctoring session's snapshots. */
export async function analyzeProctorSessionAction(
  sessionId: string
): Promise<{ ok: true; summary: ProctorReviewSummary } | { ok: false; error: string }> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorised." };
    throw e;
  }
  if (!SESSION_RE.test(sessionId)) return { ok: false, error: "Invalid session id." };
  const res = await analyzeProctorSession(sessionId);
  revalidatePath(`/admin/proctor/${sessionId}`);
  return res;
}
