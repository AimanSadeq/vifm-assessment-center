// Client-portal voucher issuance (server-only). One entry point that a client
// manager's portal action calls to issue + email a batch of single-use codes for
// a voucher service, drawing atomically from their admin-granted allocation.
// Reuses each service's existing voucher engine + email function unchanged - this
// only orchestrates (draw allocation -> generate -> email -> release on failure).
// The CALLER (the server action) must have already gated role + resolved the org
// from the caller's profile; orgId is never trusted from client input.

import { drawAllocation, releaseAllocation, type Allocation } from "./allocations";
import type { CaliberService } from "./portal-services";
import { createServiceClient } from "@/lib/supabase/server";
import { createVoucherBatch as createFluentBatch } from "@/lib/fluent/vouchers";
import { createVoucherBatch as createLogicaBatch } from "@/lib/cognitive/vouchers";
import { createVoucherBatch as createPersonaBatch } from "@/lib/persona/vouchers";
import { generateVoucherBatch as generateTechnoBatch } from "@/lib/technical-sandbox/vouchers";
import { emailVoucherLink as emailLogicaLink, appOrigin } from "@/lib/cognitive/email";
import { emailVoucherLink as emailPersonaLink } from "@/lib/persona/email";
import { emailVoucherLink as emailFluentLink } from "@/lib/fluent/email";
import { emailAccessLink as emailTechnoLink } from "@/lib/technical-sandbox/email";

export type Delegate = { email: string; name?: string };

export type IssueResult = {
  ok: boolean;
  issued: number;
  emailed: number;
  error?: string;
  /** When email is unavailable (Resend unconfigured), the codes are returned so
   *  the manager can copy/share them. */
  codes?: { email: string; name?: string; code: string; url: string; emailed: boolean }[];
};

const VOUCHER_SERVICES: CaliberService[] = ["fluent", "logica", "persona", "techno"];
export function isVoucherService(s: CaliberService): boolean {
  return VOUCHER_SERVICES.includes(s);
}

const REDEEM_PATH: Record<string, string> = {
  fluent: "/ac/fluent/redeem",
  logica: "/ac/cognitive/redeem",
  persona: "/ac/persona/redeem",
  techno: "/tech-sandbox/redeem",
};

/** Resolve which technical function a Techno allocation assesses: the admin-pinned
 *  service_config.functionId, else the first catalogue function (MVP default). */
async function resolveTechnoFunction(alloc: Allocation): Promise<{ id: string; name: string } | null> {
  const cfg = (alloc.service_config ?? {}) as { functionId?: string };
  const sb = createServiceClient();
  try {
    if (cfg.functionId) {
      const { data } = await sb
        .from("technical_functions")
        .select("id, name_en")
        .eq("id", cfg.functionId)
        .maybeSingle<{ id: string; name_en: string }>();
      if (data) return { id: data.id, name: data.name_en };
    }
    const { data } = await sb
      .from("technical_functions")
      .select("id, name_en")
      .order("name_en")
      .limit(1)
      .maybeSingle<{ id: string; name_en: string }>();
    if (data) return { id: data.id, name: data.name_en };
  } catch {
    /* catalogue table absent */
  }
  return null;
}

/** Issue one single-use code per delegate for a voucher service, drawing seats
 *  from the allocation and emailing each delegate their link (best-effort). */
export async function issueClientVouchers(opts: {
  service: CaliberService;
  orgId: string;
  clientName: string | null;
  lang: "en" | "ar";
  delegates: Delegate[];
  alloc: Allocation;
}): Promise<IssueResult> {
  const { service, orgId, clientName, lang, delegates, alloc } = opts;
  if (!isVoucherService(service)) return { ok: false, issued: 0, emailed: 0, error: "Not a self-serve voucher service" };
  const count = delegates.length;
  if (count === 0) return { ok: false, issued: 0, emailed: 0, error: "Add at least one recipient" };

  // 1. Reserve seats atomically (over-quota / expired -> refused).
  const draw = await drawAllocation(orgId, service, count);
  if (!draw.ok) {
    return {
      ok: false,
      issued: 0,
      emailed: 0,
      error:
        draw.reason === "over_quota"
          ? "Not enough seats remaining (or the allocation has expired)."
          : draw.message || "Could not reserve seats.",
    };
  }

  // 2. Generate the codes via the service's own engine.
  let codes: string[] = [];
  let technoFunctionName = "Technical Assessment";
  try {
    if (service === "fluent") {
      const r = await createFluentBatch({ count, organizationId: orgId, clientName, language: lang, maxUses: 1, expiresAt: alloc.expires_at });
      if (!r.ok) throw new Error(r.error);
      codes = r.codes;
    } else if (service === "logica") {
      const r = await createLogicaBatch({ count, organizationId: orgId, clientName, language: lang, maxUses: 1, expiresAt: alloc.expires_at });
      if (!r.ok) throw new Error(r.error);
      codes = r.codes;
    } else if (service === "persona") {
      const cfg = (alloc.service_config ?? {}) as {
        purpose?: "development" | "hiring" | null;
        targetRoleProfileId?: string | null;
        itemFormat?: "normative" | "ipsative" | "both";
        scopedCompetencyIds?: string[] | null;
      };
      const r = await createPersonaBatch({
        count,
        organizationId: orgId,
        clientName,
        language: lang,
        maxUses: 1,
        expiresAt: alloc.expires_at,
        purpose: cfg.purpose ?? "development",
        targetRoleProfileId: cfg.targetRoleProfileId ?? null,
        itemFormat: cfg.itemFormat ?? "normative",
        scopedCompetencyIds: cfg.scopedCompetencyIds ?? null,
      });
      if (!r.ok) throw new Error(r.error);
      codes = r.codes;
    } else if (service === "techno") {
      // Name-bridge MVP: Techno keys on organization_name (no org id FK yet).
      const fn = await resolveTechnoFunction(alloc);
      if (!fn) throw new Error("VIFM has not configured a technical function for this allocation.");
      technoFunctionName = fn.name;
      const r = await generateTechnoBatch({
        functionId: fn.id,
        count,
        organizationName: clientName,
        expiresAt: alloc.expires_at,
        delegates: delegates.map((d) => ({ name: d.name?.trim() || d.email, email: d.email })),
      });
      const byEmail = new Map(r.assignments.map((a) => [a.email.toLowerCase(), a.code]));
      codes = delegates.map((d) => byEmail.get(d.email.toLowerCase()) ?? "");
    }
  } catch (e) {
    await releaseAllocation(orgId, service, count); // give the seats back
    return { ok: false, issued: 0, emailed: 0, error: e instanceof Error ? e.message : "Could not generate vouchers" };
  }

  // 3. Email each delegate their redeem link (best-effort; Fluent has no email).
  const origin = appOrigin();
  const path = REDEEM_PATH[service];
  const out: NonNullable<IssueResult["codes"]> = [];
  let emailed = 0;
  for (let i = 0; i < delegates.length; i++) {
    const d = delegates[i];
    const code = codes[i];
    const url = `${origin}${path}?code=${encodeURIComponent(code)}&email=${encodeURIComponent(d.email)}`;
    let sent = false;
    try {
      if (service === "fluent") sent = !!(await emailFluentLink({ to: d.email, name: d.name, code, url, lang })).ok;
      else if (service === "logica") sent = !!(await emailLogicaLink({ to: d.email, name: d.name, code, url, lang })).ok;
      else if (service === "persona") sent = !!(await emailPersonaLink({ to: d.email, name: d.name, code, url, lang })).ok;
      else if (service === "techno") sent = !!(await emailTechnoLink({ to: d.email, name: d.name, functionName: technoFunctionName, url, code })).ok;
    } catch {
      sent = false;
    }
    if (sent) emailed++;
    out.push({ email: d.email, name: d.name, code, url, emailed: sent });
  }

  return { ok: true, issued: codes.length, emailed, codes: out };
}
