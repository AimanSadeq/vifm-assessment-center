"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { setTimerMinutes } from "@/lib/assessment-timers";

const TYPE_SCOPES = ["quiz", "fluent"] as const;
type TypeScope = (typeof TYPE_SCOPES)[number];

/** Set the admin time limit (minutes) for a type-level assessment (quiz / fluent). */
export async function setAssessmentTimerAction(scope: TypeScope, minutes: number) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (!TYPE_SCOPES.includes(scope)) return { error: "invalid scope" };
  const m = Math.max(1, Math.min(600, Math.round(Number(minutes))));
  if (!Number.isFinite(m)) return { error: "invalid minutes" };
  const res = await setTimerMinutes(scope, m);
  if (!res.ok) return { error: res.error ?? "Could not save (apply migration 00083)." };
  revalidatePath("/admin/settings");
  return { ok: true };
}
