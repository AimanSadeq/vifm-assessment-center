"use server";

import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createSession, listFunctionDescriptors } from "@/lib/technical-sandbox/service";
import { matchJobDescription } from "@/lib/technical-sandbox/jd-matcher";
import { pingSandboxDb } from "@/lib/technical-sandbox/sql-runner";

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
