/**
 * What the platform knows about one voucher issuance (Persona, Logica, Fluent,
 * Techno), as checklist facts.
 *
 * These services have no engagement record. The client-facing unit is the
 * batch of codes issued to one organisation in one go (a shared batch_id), so
 * the checklist subject is the batch. A voucher that predates batches is its
 * own subject.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistFacts, ChecklistService } from "./types";

type Row = Record<string, unknown>;

export type VoucherService = Extract<ChecklistService, "persona" | "logica" | "fluent" | "techno">;

export const VOUCHER_SERVICES: VoucherService[] = ["persona", "logica", "fluent", "techno"];

export function isVoucherService(s: ChecklistService): s is VoucherService {
  return (VOUCHER_SERVICES as ChecklistService[]).includes(s);
}

export type VoucherChecklistSubject = {
  id: string;
  name: string;
  status: string;
  organisationName: string | null;
  codes: number;
  seats: number;
  used: number;
};

type Spec = {
  label: string;
  table: string;
  /** Columns beyond the shared voucher shape; read tolerantly. */
  extra: string;
  redemptions: string;
  resultFk: "result_id" | "session_id";
  resultTable: string;
  resultSelect: string;
  resultDone: (r: Row) => boolean;
  reportDone: (r: Row) => boolean;
  reportLabel: string;
  orgName: (v: Row) => string | null;
  scope: (v: Row, fn: Row | null) => { done: boolean; detail: string };
};

/** Columns every voucher table has had since it was created. */
const BASE = "id, code, label, batch_id, max_uses, used_count, status, expires_at, created_at";
/** Columns added later (00168 contact, 00190 techno org id); peeled on a fresh environment. */
const LATER = "organization_id, contact_name, contact_email";

export const VOUCHER_SPECS: Record<VoucherService, Spec> = {
  persona: {
    label: "Persona",
    table: "persona_vouchers",
    extra: "client_name, default_language, purpose, target_role_profile_id, scoped_competency_ids, item_format, project_label",
    redemptions: "persona_voucher_redemptions",
    resultFk: "result_id",
    resultTable: "behavioral_assessment_sessions",
    resultSelect: "id, status, submitted_at",
    resultDone: (r) => r.status === "submitted" || Boolean(r.submitted_at),
    reportDone: (r) => r.status === "submitted" || Boolean(r.submitted_at),
    reportLabel: "reports available",
    orgName: (v) => (v.client_name as string | null) ?? null,
    scope: (v) => {
      const scoped = Array.isArray(v.scoped_competency_ids) ? v.scoped_competency_ids.length : 0;
      const parts = [
        v.purpose ? `purpose: ${String(v.purpose)}` : null,
        v.target_role_profile_id ? "role profile bound" : scoped ? `${scoped} competencies` : "full framework",
        v.item_format ? `${String(v.item_format)} items` : null,
        v.project_label ? `project: ${String(v.project_label)}` : null,
      ].filter(Boolean);
      return { done: Boolean(v.purpose), detail: v.purpose ? parts.join(", ") : "Purpose not set (development or hiring)" };
    },
  },
  logica: {
    label: "Logica",
    table: "cognitive_vouchers",
    extra: "client_name, default_language, subtests, project_label",
    redemptions: "cognitive_voucher_redemptions",
    resultFk: "result_id",
    resultTable: "psy_results",
    resultSelect: "id, created_at",
    resultDone: () => true,
    reportDone: () => true,
    reportLabel: "reports available",
    orgName: (v) => (v.client_name as string | null) ?? null,
    scope: (v) => {
      const subs = Array.isArray(v.subtests) ? (v.subtests as string[]) : [];
      const project = v.project_label ? `; project: ${String(v.project_label)}` : "";
      return { done: true, detail: (subs.length ? `Subtests: ${subs.join(", ")}` : "All subtests") + project };
    },
  },
  fluent: {
    label: "Fluent",
    table: "eng_fluent_vouchers",
    extra: "client_name, default_language, proctor_enabled",
    redemptions: "eng_fluent_voucher_redemptions",
    resultFk: "result_id",
    resultTable: "eng_fluent_results",
    resultSelect: "id, overall_cefr, email_sent_at",
    resultDone: (r) => Boolean(r.overall_cefr),
    reportDone: (r) => Boolean(r.email_sent_at),
    reportLabel: "results emailed to the taker",
    orgName: (v) => (v.client_name as string | null) ?? null,
    scope: (v) => ({ done: true, detail: v.proctor_enabled ? "Camera proctoring on" : "No proctoring" }),
  },
  techno: {
    label: "Techno",
    table: "technical_sandbox_vouchers",
    extra: "organization_name, function_id, talent_lens, assigned_email",
    redemptions: "technical_sandbox_voucher_redemptions",
    resultFk: "session_id",
    resultTable: "technical_sandbox_sessions",
    resultSelect: "id, status, submitted_at, pdf_url",
    resultDone: (r) => r.status === "submitted" || Boolean(r.submitted_at),
    reportDone: (r) => Boolean(r.pdf_url),
    reportLabel: "reports stored",
    orgName: (v) => (v.organization_name as string | null) ?? null,
    scope: (v, fn) => ({
      done: Boolean(v.function_id),
      detail: fn?.name_en ? `Function: ${String(fn.name_en)}${v.talent_lens ? ` (${String(v.talent_lens)})` : ""}` : "No function chosen",
    }),
  },
};

const safe = <T,>(p: PromiseLike<{ data: T[] | null }>, fallback: T[] = []) =>
  Promise.resolve(p).then((r) => (r.data ?? fallback) as T[], () => fallback);

/** Read the vouchers of one subject: the batch, or the single legacy voucher. */
async function readVouchers(sb: SupabaseClient, spec: Spec, subjectId: string): Promise<Row[]> {
  const attempt = async (cols: string, col: "batch_id" | "id") => {
    const r = await sb.from(spec.table).select(cols).eq(col, subjectId).order("created_at").limit(1000);
    if (r.error) throw r.error;
    return ((r.data ?? []) as unknown) as Row[];
  };
  for (const cols of [`${BASE}, ${LATER}, ${spec.extra}`, `${BASE}, ${LATER}`, BASE]) {
    try {
      const byBatch = await attempt(cols, "batch_id");
      if (byBatch.length) return byBatch;
      return await attempt(cols, "id");
    } catch {
      // A column from a later migration is missing: fall back to the shared shape.
    }
  }
  return [];
}

export async function loadVoucherChecklistFacts(
  sb: SupabaseClient,
  service: VoucherService,
  subjectId: string
): Promise<{ subject: VoucherChecklistSubject; facts: ChecklistFacts } | null> {
  const spec = VOUCHER_SPECS[service];
  const vouchers = await readVouchers(sb, spec, subjectId);
  if (!vouchers.length) return null;
  const first = vouchers[0];
  const ids = vouchers.map((v) => String(v.id));
  const orgId = (vouchers.find((v) => v.organization_id)?.organization_id as string | null) ?? null;

  const [redemptions, proposals, fn] = await Promise.all([
    safe<Row>(sb.from(spec.redemptions).select(`voucher_id, redeemed_at, ${spec.resultFk}`).in("voucher_id", ids).limit(5000) as unknown as PromiseLike<{ data: Row[] | null }>),
    orgId ? safe<Row>(sb.from("proposals").select("status").eq("organization_id", orgId)) : Promise.resolve([] as Row[]),
    service === "techno" && first.function_id
      ? Promise.resolve(sb.from("technical_functions").select("id, name_en").eq("id", String(first.function_id)).maybeSingle()).then((r) => (r.data as Row | null) ?? null, () => null)
      : Promise.resolve(null),
  ]);
  const resultIds = redemptions.map((r) => r[spec.resultFk]).filter(Boolean).map(String);
  const results = resultIds.length
    ? await safe<Row>(sb.from(spec.resultTable).select(spec.resultSelect).in("id", resultIds).limit(5000) as unknown as PromiseLike<{ data: Row[] | null }>)
    : [];

  const seats = vouchers.reduce((s, v) => s + Number(v.max_uses ?? 0), 0);
  const used = vouchers.reduce((s, v) => s + Number(v.used_count ?? 0), 0);
  const redeemed = Math.max(used, redemptions.length);
  const completed = results.filter(spec.resultDone).length;
  const reported = results.filter(spec.reportDone).length;
  const now = Date.now();
  const expiries = vouchers.map((v) => (v.expires_at ? Date.parse(String(v.expires_at)) : null));
  const allExpired = expiries.every((t) => t !== null && t < now);
  const firstExpiry = expiries.find((t) => t !== null) ?? null;
  const disabled = vouchers.every((v) => v.status === "disabled");
  const closed = disabled || allExpired;
  const orgName = spec.orgName(first);
  const contact = vouchers.find((v) => v.contact_name || v.contact_email);
  const won = proposals.some((p) => p.status === "won");
  const issued = proposals.some((p) => p.status === "issued");
  const scope = spec.scope(first, fn);
  const p = service;

  const facts: ChecklistFacts = {
    [`${p}.org`]: { done: Boolean(orgId), detail: orgId ? orgName ?? "Organisation linked" : orgName ? `${orgName} (name only, not linked to a client record)` : "No organisation" },
    [`${p}.contact`]: { done: Boolean(contact), detail: contact ? String(contact.contact_name ?? contact.contact_email) : "No client contact on the voucher" },
    [`${p}.proposal`]: { done: won, detail: won ? "Proposal won" : issued ? "Proposal issued, not yet accepted" : orgId ? "No proposal for this organisation" : "No linked organisation" },
    [`${p}.scope`]: scope,
    [`${p}.seats`]: { done: seats > 0, detail: `${vouchers.length} code${vouchers.length === 1 ? "" : "s"}, ${seats} seat${seats === 1 ? "" : "s"}` },
    [`${p}.expiry`]: { done: firstExpiry !== null && !allExpired, detail: firstExpiry === null ? "No expiry set" : allExpired ? "Expired" : `Expires ${new Date(firstExpiry).toISOString().slice(0, 10)}` },
    [`${p}.language`]: { done: true, detail: `Default language: ${String(first.default_language ?? "en")}` },
    [`${p}.issued`]: { done: true, detail: `Issued ${String(first.created_at ?? "").slice(0, 10)}${first.label ? `: ${String(first.label)}` : ""}` },
    [`${p}.redeemed`]: { done: seats > 0 && redeemed >= seats, detail: `${redeemed} of ${seats} seats redeemed` },
    [`${p}.completed`]: { done: seats > 0 && completed >= seats, detail: `${completed} of ${seats} completed` },
    [`${p}.reports`]: { done: completed > 0 && reported >= completed, detail: `${reported} of ${completed} ${spec.reportLabel}` },
    [`${p}.closed`]: { done: closed, detail: disabled ? "Codes disabled" : allExpired ? "Expired" : "Still open" },
  };

  return {
    subject: {
      id: subjectId,
      name: `${orgName ?? "Client"} - ${spec.label}${first.label ? `: ${String(first.label)}` : ""}`,
      status: closed ? "closed" : seats > 0 && redeemed >= seats ? "fully redeemed" : redeemed > 0 ? "in progress" : "issued",
      organisationName: orgName,
      codes: vouchers.length,
      seats,
      used: redeemed,
    },
    facts,
  };
}

/**
 * The most recent issuances of one voucher service, one id per batch, for the
 * overview page. `openOnly` drops disabled or expired batches.
 */
export async function listVoucherSubjects(sb: SupabaseClient, service: VoucherService, openOnly: boolean, limit = 25): Promise<string[]> {
  const spec = VOUCHER_SPECS[service];
  const rows = await safe<Row>(sb.from(spec.table).select("id, batch_id, status, expires_at, created_at").order("created_at", { ascending: false }).limit(1500));
  const now = Date.now();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of rows) {
    const key = String(v.batch_id ?? v.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const expired = v.expires_at ? Date.parse(String(v.expires_at)) < now : false;
    if (openOnly && (v.status === "disabled" || expired)) continue;
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}
