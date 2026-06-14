"use server";

import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createSession, listFunctionDescriptors } from "@/lib/technical-sandbox/service";
import { matchJobDescription } from "@/lib/technical-sandbox/jd-matcher";
import { pingSandboxDb } from "@/lib/technical-sandbox/sql-runner";
import { generateVoucherBatch, setVoucherStatus } from "@/lib/technical-sandbox/vouchers";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = ({ ok: true } & T) | { error: string };

export async function checkSandboxDbAction(): Promise<Result<{ detail?: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  const res = await pingSandboxDb();
  if (!res.ok) return { error: res.error ?? "Sandbox DB unreachable." };
  return { ok: true, detail: res.detail };
}

async function guard(): Promise<{ ok: true; userId?: string } | { error: string }> {
  try {
    const caller = await requireRole(["admin"]);
    return { ok: true, userId: caller.uid };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

export async function matchJdAction(jdText: string): Promise<Result<{ matches: ReturnType<typeof matchJobDescription> }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!jdText || jdText.trim().length < 10) return { error: "Paste a longer job description." };
  const descriptors = await listFunctionDescriptors();
  const matches = matchJobDescription(jdText, descriptors, { limit: 5 });
  return { ok: true, matches };
}

export async function createSandboxSessionAction(input: {
  functionId: string;
  candidateName?: string;
  candidateEmail?: string;
  organizationName?: string;
}): Promise<Result<{ token: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!input.functionId) return { error: "Select a function." };
  const { accessToken } = await createSession({
    functionId: input.functionId,
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    organizationName: input.organizationName,
    invitedBy: "userId" in g ? g.userId : undefined,
  });
  return { ok: true, token: accessToken };
}

export async function generateVouchersAction(input: {
  functionId: string;
  count: number;
  organizationName?: string;
  label?: string;
  maxUsesPerCode?: number;
  expiresAt?: string;
  delegates?: { name: string; email: string }[];
}): Promise<Result<{ codes: string[]; assignments: { name: string; email: string; code: string }[] }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!input.functionId) return { error: "Select a function." };
  const named = (input.delegates ?? []).filter((d) => d.name?.trim() && d.email?.trim());
  if (named.length === 0 && (!input.count || input.count < 1)) {
    return { error: "Enter how many codes to generate, or add at least one delegate." };
  }
  const { codes, assignments } = await generateVoucherBatch({
    functionId: input.functionId,
    count: input.count,
    organizationName: input.organizationName || null,
    label: input.label || null,
    maxUsesPerCode: input.maxUsesPerCode ?? 1,
    expiresAt: input.expiresAt || null,
    delegates: named.length > 0 ? named : null,
    createdBy: "userId" in g ? g.userId : undefined,
  });
  revalidatePath("/admin/tech-sandbox/vouchers");
  revalidatePath("/admin/tech-sandbox");
  return { ok: true, codes, assignments };
}

export async function setVoucherStatusAction(input: {
  id: string;
  status: "active" | "disabled";
}): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  await setVoucherStatus(input.id, input.status);
  revalidatePath("/admin/tech-sandbox/vouchers");
  return { ok: true };
}
