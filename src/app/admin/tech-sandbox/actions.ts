"use server";

import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import {
  createSession,
  listFunctionDescriptors,
  listFunctions,
  getSessionByToken,
} from "@/lib/technical-sandbox/service";
import { matchJobDescription } from "@/lib/technical-sandbox/jd-matcher";
import { pingSandboxDb } from "@/lib/technical-sandbox/sql-runner";
import {
  generateVoucherBatch,
  setVoucherStatus,
  getVouchersByCodes,
} from "@/lib/technical-sandbox/vouchers";
import { emailAccessLink, appOrigin } from "@/lib/technical-sandbox/email";
import { revalidatePath } from "next/cache";

function functionLabel(fn?: { nodeId: string | null; nameEn: string }): string {
  if (!fn) return "Technical Assessment";
  return [fn.nodeId, fn.nameEn].filter(Boolean).join(" · ");
}

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
  talentLens?: "acquisition" | "development" | null;
}): Promise<Result<{ token: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!input.functionId) return { error: "Select a function." };
  const { accessToken } = await createSession({
    functionId: input.functionId,
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    organizationName: input.organizationName,
    talentLens: input.talentLens,
    invitedBy: "userId" in g ? g.userId : undefined,
  });
  return { ok: true, token: accessToken };
}

/**
 * Issue a CUSTOM (pick-and-choose) technical sitting from one function: a chosen
 * subset of its knowledge skills and/or hands-on tasks. Indicative by design -
 * a hand-picked subset of the blueprint is not the certified whole, so a custom
 * sitting issues NO credential (enforced server-side in submitSession too).
 */
export async function createCustomSandboxSessionAction(input: {
  functionId: string;
  selectedSkills: string[];
  selectedBlockIds: string[];
  mcqPct: number;
  candidateName?: string;
  candidateEmail?: string;
  organizationName?: string;
  assessmentTitle?: string;
  talentLens?: "acquisition" | "development" | null;
}): Promise<Result<{ token: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!input.functionId) return { error: "Select a function." };
  const skills = (input.selectedSkills ?? []).filter(Boolean);
  const blockIds = (input.selectedBlockIds ?? []).filter(Boolean);
  const mcqPct = Math.max(0, Math.min(100, Math.round(input.mcqPct ?? 0)));
  // Must assess something: at least one hands-on task, or a knowledge section.
  if (blockIds.length === 0 && !(mcqPct > 0 && skills.length > 0)) {
    return { error: "Pick at least one hands-on task, or select knowledge skills with a knowledge weight." };
  }
  const { accessToken } = await createSession({
    functionId: input.functionId,
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    organizationName: input.organizationName,
    assessmentTitle: input.assessmentTitle,
    talentLens: input.talentLens,
    invitedBy: "userId" in g ? g.userId : undefined,
    isCustom: true,
    mcqPct,
    selectedSkills: skills,
    selectedBlockIds: blockIds,
  });
  return { ok: true, token: accessToken };
}

/**
 * TECH-1: issue ONE custom sitting per delegate from a single confirmed design.
 * The design (skills/tasks/weight/title/lens) is shared; the client + delegate
 * roster are applied after the design is confirmed. With an empty roster a single
 * unassigned link is created so the builder can still produce a shareable link.
 */
export async function createCustomSandboxSessionsAction(input: {
  functionId: string;
  selectedSkills: string[];
  selectedBlockIds: string[];
  mcqPct: number;
  assessmentTitle?: string;
  organizationName?: string;
  talentLens?: "acquisition" | "development" | null;
  delegates?: { name: string; email: string }[];
}): Promise<Result<{ results: { name: string | null; email: string | null; token: string; link: string }[] }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!input.functionId) return { error: "Select a function." };
  const skills = (input.selectedSkills ?? []).filter(Boolean);
  const blockIds = (input.selectedBlockIds ?? []).filter(Boolean);
  const mcqPct = Math.max(0, Math.min(100, Math.round(input.mcqPct ?? 0)));
  if (blockIds.length === 0 && !(mcqPct > 0 && skills.length > 0)) {
    return { error: "Pick at least one hands-on task, or select knowledge skills with a knowledge weight." };
  }

  // Keep only delegates with a name AND email; an empty roster yields one
  // unassigned link. Cap the batch defensively.
  const roster = (input.delegates ?? [])
    .map((d) => ({ name: d.name?.trim() ?? "", email: d.email?.trim() ?? "" }))
    .filter((d) => d.name && d.email);
  if (roster.length > 200) return { error: "Max 200 delegates per batch." };
  const targets: { name: string | null; email: string | null }[] =
    roster.length > 0 ? roster : [{ name: null, email: null }];

  const origin = appOrigin();
  const results: { name: string | null; email: string | null; token: string; link: string }[] = [];
  for (const t of targets) {
    const { accessToken } = await createSession({
      functionId: input.functionId,
      candidateName: t.name ?? undefined,
      candidateEmail: t.email ?? undefined,
      organizationName: input.organizationName,
      assessmentTitle: input.assessmentTitle,
      talentLens: input.talentLens,
      invitedBy: "userId" in g ? g.userId : undefined,
      isCustom: true,
      mcqPct,
      selectedSkills: skills,
      selectedBlockIds: blockIds,
    });
    results.push({
      name: t.name,
      email: t.email,
      token: accessToken,
      link: `${origin}/tech-sandbox/${accessToken}`,
    });
  }
  return { ok: true, results };
}

export async function generateVouchersAction(input: {
  functionId: string;
  count: number;
  organizationName?: string;
  label?: string;
  maxUsesPerCode?: number;
  expiresAt?: string;
  delegates?: { name: string; email: string }[];
  mcqPct?: number;
  talentLens?: "acquisition" | "development" | null;
  /** Custom (pick-and-choose) sitting design carried to the redeemed session (00141). */
  customConfig?: { skills: string[]; blockIds: string[]; title?: string | null } | null;
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
    // Carry the custom title as the batch label so it is recognisable in the
    // voucher list when the builder issued it.
    label: input.label || input.customConfig?.title || null,
    maxUsesPerCode: input.maxUsesPerCode ?? 1,
    expiresAt: input.expiresAt || null,
    delegates: named.length > 0 ? named : null,
    createdBy: "userId" in g ? g.userId : undefined,
    mcqPct: input.mcqPct ?? 0,
    talentLens: input.talentLens ?? null,
    customConfig: input.customConfig ?? null,
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

/** Email a direct-link session's access link to the candidate on file. */
export async function emailSandboxLinkAction(input: {
  token: string;
}): Promise<Result<{ to: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  const session = await getSessionByToken(input.token);
  if (!session) return { error: "Session not found." };
  if (!session.candidate_email) return { error: "No candidate email on file for this session." };
  const fns = await listFunctions();
  const url = `${appOrigin()}/tech-sandbox/${input.token}`;
  const res = await emailAccessLink({
    to: session.candidate_email,
    name: session.candidate_name ?? undefined,
    functionName: functionLabel(fns.find((f) => f.id === session.function_id)),
    url,
  });
  if (!res.ok) return { error: res.error ?? "Could not send email." };
  return { ok: true, to: session.candidate_email };
}

/**
 * Email named-delegate voucher codes with a one-click redeem link (code + name +
 * email + company baked into the URL). Only codes that carry an assigned delegate
 * email are sent. Returns per-email results.
 */
export async function emailVoucherCodesAction(input: {
  codes: string[];
}): Promise<Result<{ sent: number; total: number; results: { email: string; ok: boolean; error?: string }[] }>> {
  const g = await guard();
  if ("error" in g) return g;
  const codes = (input.codes ?? []).filter(Boolean);
  if (codes.length === 0) return { error: "No codes to email." };

  const vouchers = await getVouchersByCodes(codes);
  const withEmail = vouchers.filter((v) => v.assignedEmail);
  if (withEmail.length === 0) return { error: "None of these codes have an assigned delegate email." };
  if (withEmail.length > 200) return { error: "Max 200 delegates per send." };

  const fns = await listFunctions();
  const fnById = new Map(fns.map((f) => [f.id, f]));
  const origin = appOrigin();
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const v of withEmail) {
    const email = v.assignedEmail;
    if (!email) continue;
    const qs = new URLSearchParams({ code: v.code, email });
    if (v.assignedName) qs.set("name", v.assignedName);
    if (v.organizationName) qs.set("company", v.organizationName);
    const sent = await emailAccessLink({
      to: email,
      name: v.assignedName ?? undefined,
      functionName: functionLabel(fnById.get(v.functionId)),
      url: `${origin}/tech-sandbox/redeem?${qs.toString()}`,
      code: v.code,
    });
    results.push({ email, ok: sent.ok, error: sent.error });
  }

  const sent = results.filter((r) => r.ok).length;
  return { ok: true, sent, total: results.length, results };
}
