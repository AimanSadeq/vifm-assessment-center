// Bespoke bundle voucher engine - parity with the other portals' voucher model.
// A pool voucher (N seats) or an individual voucher (one per recipient). Redeeming
// a code provisions a bundle_candidates row and returns its apply token. Service
// role throughout (issuance from the admin action; redeem from the public,
// auth-bypassed /bundle/redeem flow). Mirrors src/lib/role-readiness/vouchers.ts.

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { redeemViaDescriptor } from "@/lib/vouchers/core";
import { VOUCHER_DESCRIPTORS } from "@/lib/vouchers/descriptor";
import { normalizeVoucherExpiry } from "@/lib/vouchers/expiry";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
function genCode(): string {
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `BND-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public redeem URL - only the CODE travels in the URL (PII resolved server-side). */
export function redeemUrlFor(origin: string, code: string): string {
  const params = new URLSearchParams({ code });
  return `${origin.replace(/\/$/, "")}/bundle/redeem?${params.toString()}`;
}

export type BundleVoucherRow = {
  id: string;
  code: string;
  recipient_email: string | null;
  recipient_name: string | null;
  label: string | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  created_at: string;
};

/** Create a bundle voucher. `pool` = one shared N-seat code; `individual` = one
 *  single-use code per email. Returns the issued code(s). */
export async function createBundleVoucher(input: {
  bundleId: string;
  mode: "pool" | "individual";
  seats?: number;
  emails?: string[];
  label?: string | null;
  expiresAt?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: true; codes: string[] } | { error: string }> {
  const sb = createServiceClient();

  // The bundle must exist + be active; org is inherited from it.
  const { data: bundle } = await sb
    .from("bespoke_services")
    .select("id, kind, status, organization_id")
    .eq("id", input.bundleId)
    .maybeSingle<{ id: string; kind: string; status: string; organization_id: string | null }>();
  if (!bundle || bundle.kind !== "bundle" || bundle.status !== "active") {
    return { error: "Bundle not found (it may have been archived)." };
  }

  const base = {
    bespoke_service_id: bundle.id,
    organization_id: bundle.organization_id,
    label: input.label?.trim() || null,
    expires_at: normalizeVoucherExpiry(input.expiresAt),
    created_by: input.createdBy ?? null,
  };

  if (input.mode === "individual") {
    const seen = new Set<string>();
    const rows = (input.emails ?? [])
      .map((e) => (e || "").trim().toLowerCase())
      .filter((e) => EMAIL_RE.test(e) && !seen.has(e) && (seen.add(e), true))
      .map((email) => ({ ...base, code: genCode(), max_uses: 1, recipient_email: email }));
    if (rows.length === 0) return { error: "Add at least one valid email address." };
    if (rows.length > 500) return { error: "Up to 500 recipients per batch." };
    const { data, error } = await sb.from("bundle_vouchers").insert(rows).select("code");
    if (error || !data) return { error: error?.message ?? "Could not create vouchers." };
    return { ok: true, codes: (data as { code: string }[]).map((v) => v.code) };
  }

  // pool
  const seats = Math.floor(Number(input.seats));
  if (!Number.isFinite(seats) || seats < 1) return { error: "Enter at least 1 seat." };
  if (seats > 1000) return { error: "Up to 1000 seats per shared link." };
  const { data, error } = await sb
    .from("bundle_vouchers")
    .insert({ ...base, code: genCode(), max_uses: seats })
    .select("code")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the shared voucher." };
  return { ok: true, codes: [(data as { code: string }).code] };
}

/** Redeem a code: atomically claim a seat, provision a bundle_candidate, return
 *  its apply token. Race-safe via the conditional UPDATE (uses < max_uses). */
export async function redeemBundleVoucher(input: {
  code: string;
  fullName: string;
  email: string;
}): Promise<{ ok: true; token: string } | { error: string }> {
  const name = (input.fullName || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  if (!input.code.trim()) return { error: "Missing voucher code." };
  if (name.length < 2 || !EMAIL_RE.test(email)) return { error: "Enter your name and a valid email." };

  const out = await redeemViaDescriptor<{ bespoke_service_id: string; organization_id: string | null }>(
    VOUCHER_DESCRIPTORS.bundle,
    { code: input.code, redeemerName: name, redeemerEmail: email },
    async ({ sb, voucher }) => {
      // Guard against a voucher whose bundle was archived after issuance.
      const { data: bundle } = await sb
        .from("bespoke_services")
        .select("status")
        .eq("id", voucher.bespoke_service_id)
        .maybeSingle<{ status: string }>();
      if (!bundle || bundle.status !== "active") {
        return { ok: false, error: "This programme is no longer available. Please contact the organisation that invited you." };
      }
      const { data: cand, error: candErr } = await sb
        .from("bundle_candidates")
        .insert({
          bespoke_service_id: voucher.bespoke_service_id,
          organization_id: voucher.organization_id ?? null,
          full_name: name,
          email,
        })
        .select("access_token")
        .single();
      if (candErr || !cand) return { ok: false, error: candErr?.message ?? "Could not start the assessment." };
      return { ok: true, token: cand.access_token as string };
    },
    {
      onClaimFailed: async ({ sb, code }) => {
        const { data: exists } = await sb.from("bundle_vouchers").select("id").eq("code", code).maybeSingle();
        return exists ? "This voucher has already been fully redeemed." : "Invalid voucher code.";
      },
    },
  );
  if (!out.ok) return { error: out.error };
  return { ok: true, token: out.token as string };
}

/** List a bundle's vouchers (admin/client - service role). */
export async function loadBundleVouchers(bundleId: string): Promise<BundleVoucherRow[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("bundle_vouchers")
    .select("id, code, recipient_email, recipient_name, label, max_uses, uses, expires_at, created_at")
    .eq("bespoke_service_id", bundleId)
    .order("created_at", { ascending: false });
  return (data ?? []) as BundleVoucherRow[];
}
