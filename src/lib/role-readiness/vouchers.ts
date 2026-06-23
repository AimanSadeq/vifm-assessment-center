// Role Readiness voucher engine - parity with the other portals' voucher model.
// Individual vouchers (one per recipient, single use) or one shared pool voucher
// (N seats). Redeeming a code provisions an rr_candidate and returns its apply
// token. Service-role throughout (issuance from admin/client actions; redeem from
// the public, token-bypassed redeem flow).

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
function genCode(): string {
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `RR-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type IssuedVoucher = { code: string; email: string | null; maxUses: number };

export type VoucherRow = {
  id: string;
  code: string;
  recipient_email: string | null;
  max_uses: number;
  uses: number;
  created_at: string;
};

export async function createRoleReadinessVouchers(input: {
  roleConfigId: string;
  organizationId: string | null;
  mode: "individual" | "pool";
  emails?: string[];
  seats?: number;
  isSample?: boolean;
  createdBy?: string | null;
}): Promise<{ ok: true; vouchers: IssuedVoucher[] } | { error: string }> {
  const sb = createServiceClient();
  const base = {
    role_config_id: input.roleConfigId,
    organization_id: input.organizationId ?? null,
    is_sample: input.isSample ?? false,
    created_by: input.createdBy ?? null,
  };

  if (input.mode === "individual") {
    const emails = Array.from(
      new Set((input.emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))),
    );
    if (emails.length === 0) return { error: "Add at least one valid email address." };
    if (emails.length > 500) return { error: "Up to 500 recipients per batch." };
    const rows = emails.map((email) => ({ ...base, code: genCode(), max_uses: 1, recipient_email: email }));
    const { data, error } = await sb.from("rr_vouchers").insert(rows).select("code, recipient_email, max_uses");
    if (error || !data) return { error: error?.message ?? "Could not create vouchers." };
    return {
      ok: true,
      vouchers: (data as Array<{ code: string; recipient_email: string | null; max_uses: number }>).map((v) => ({
        code: v.code,
        email: v.recipient_email,
        maxUses: v.max_uses,
      })),
    };
  }

  // pool
  const seats = Math.floor(Number(input.seats));
  if (!Number.isFinite(seats) || seats < 1) return { error: "Enter at least 1 seat." };
  if (seats > 1000) return { error: "Up to 1000 seats per shared link." };
  const { data, error } = await sb
    .from("rr_vouchers")
    .insert({ ...base, code: genCode(), max_uses: seats })
    .select("code, max_uses")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the shared voucher." };
  return { ok: true, vouchers: [{ code: (data as { code: string }).code, email: null, maxUses: (data as { max_uses: number }).max_uses }] };
}

/** Redeem a code: atomically claim a seat, provision an rr_candidate, return its
 *  apply token. Race-safe via a conditional UPDATE (uses < max_uses). */
export async function redeemRoleReadinessVoucher(input: {
  code: string;
  fullName: string;
  email: string;
}): Promise<{ ok: true; token: string } | { error: string }> {
  const code = (input.code || "").trim();
  const name = (input.fullName || "").trim();
  const email = (input.email || "").trim();
  if (!code) return { error: "Missing voucher code." };
  if (name.length < 2 || !EMAIL_RE.test(email)) return { error: "Enter your name and a valid email." };

  const sb = createServiceClient();
  const { data: voucher } = await sb
    .from("rr_vouchers")
    .select("id, role_config_id, organization_id, max_uses, uses")
    .eq("code", code)
    .maybeSingle();
  if (!voucher) return { error: "Invalid voucher code." };

  // Atomic claim: only succeeds while uses < max_uses.
  const { data: claimed } = await sb
    .from("rr_vouchers")
    .update({ uses: (voucher.uses as number) + 1 })
    .eq("id", voucher.id as string)
    .lt("uses", voucher.max_uses as number)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "This voucher has already been fully redeemed." };

  const { data: cand, error: candErr } = await sb
    .from("rr_candidates")
    .insert({
      role_config_id: voucher.role_config_id as string,
      organization_id: (voucher.organization_id as string | null) ?? null,
      full_name: name,
      email,
      invited_at: new Date().toISOString(),
    })
    .select("access_token")
    .single();
  if (candErr || !cand) {
    // Hand the seat back so the code isn't silently burned.
    await sb.from("rr_vouchers").update({ uses: voucher.uses as number }).eq("id", voucher.id as string);
    return { error: candErr?.message ?? "Could not start the assessment." };
  }
  return { ok: true, token: cand.access_token as string };
}

export async function loadRoleReadinessVouchers(
  roleConfigId: string,
  organizationId?: string | null,
): Promise<VoucherRow[]> {
  const sb = createServiceClient();
  let q = sb
    .from("rr_vouchers")
    .select("id, code, recipient_email, max_uses, uses, created_at")
    .eq("role_config_id", roleConfigId)
    .order("created_at", { ascending: false });
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data } = await q;
  return (data ?? []) as VoucherRow[];
}
