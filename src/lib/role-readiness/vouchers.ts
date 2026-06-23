// Role Readiness voucher engine - parity with the other portals' voucher model.
// Individual vouchers (one per recipient, single use) or one shared pool voucher
// (N seats). Redeeming a code provisions an rr_candidate and returns its apply
// token. Service-role throughout (issuance from admin/client actions; redeem from
// the public, token-bypassed redeem flow).

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/integrations/email";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
function genCode(): string {
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `RR-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Delegate = { email: string; name?: string | null };
export type IssuedVoucher = { code: string; email: string | null; name: string | null; maxUses: number; emailed?: boolean };

/** Build the public redeem URL for a voucher (prefills email + name when known). */
export function redeemUrlFor(origin: string, v: { code: string; email?: string | null; name?: string | null }): string {
  const params = new URLSearchParams({ code: v.code });
  if (v.email) params.set("email", v.email);
  if (v.name) params.set("name", v.name);
  return `${origin.replace(/\/$/, "")}/role-readiness/redeem?${params.toString()}`;
}

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
  /** Paste path: emails only (no names). */
  emails?: string[];
  /** Upload path: name + email per delegate. Takes precedence over `emails`. */
  delegates?: Delegate[];
  seats?: number;
  isSample?: boolean;
  createdBy?: string | null;
  /** When set (individual mode), email each delegate their redeem link from this origin. */
  emailOrigin?: string | null;
}): Promise<{ ok: true; vouchers: IssuedVoucher[] } | { error: string }> {
  const sb = createServiceClient();
  const base = {
    role_config_id: input.roleConfigId,
    organization_id: input.organizationId ?? null,
    is_sample: input.isSample ?? false,
    created_by: input.createdBy ?? null,
  };

  if (input.mode === "individual") {
    // Normalise to {email, name}, deduped by email (first name wins).
    const raw: Delegate[] =
      input.delegates && input.delegates.length > 0
        ? input.delegates
        : (input.emails ?? []).map((e) => ({ email: e }));
    const byEmail = new Map<string, string | null>();
    for (const d of raw) {
      const email = (d.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || byEmail.has(email)) continue;
      const name = (d.name || "").trim();
      byEmail.set(email, name.length > 0 ? name : null);
    }
    if (byEmail.size === 0) return { error: "Add at least one valid email address." };
    if (byEmail.size > 500) return { error: "Up to 500 recipients per batch." };

    const rows = Array.from(byEmail.entries()).map(([email, name]) => ({
      ...base,
      code: genCode(),
      max_uses: 1,
      recipient_email: email,
      recipient_name: name,
    }));
    const { data, error } = await sb
      .from("rr_vouchers")
      .insert(rows)
      .select("code, recipient_email, recipient_name, max_uses");
    if (error || !data) return { error: error?.message ?? "Could not create vouchers." };

    let vouchers: IssuedVoucher[] = (
      data as Array<{ code: string; recipient_email: string | null; recipient_name: string | null; max_uses: number }>
    ).map((v) => ({ code: v.code, email: v.recipient_email, name: v.recipient_name, maxUses: v.max_uses }));

    // Optionally email each delegate their complete redeem link. Send in small
    // batches so a large list doesn't fire hundreds of concurrent requests.
    if (input.emailOrigin) {
      const origin = input.emailOrigin;
      const { data: rc } = await sb.from("rr_role_configs").select("name_en").eq("id", input.roleConfigId).maybeSingle();
      const roleName = (rc?.name_en as string | undefined) ?? "Role Readiness";
      const sendOne = async (v: IssuedVoucher): Promise<IssuedVoucher> => {
        if (!v.email) return v;
        const emailed = await sendEmail({
          to: v.email,
          template: "role_readiness_invitation",
          data: { candidateName: v.name ?? "there", roleName, redeemUrl: redeemUrlFor(origin, v) },
        }).catch(() => false);
        return { ...v, emailed };
      };
      const CHUNK = 8;
      const sent: IssuedVoucher[] = [];
      for (let i = 0; i < vouchers.length; i += CHUNK) {
        sent.push(...(await Promise.all(vouchers.slice(i, i + CHUNK).map(sendOne))));
      }
      vouchers = sent;
    }
    return { ok: true, vouchers };
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
  return {
    ok: true,
    vouchers: [{ code: (data as { code: string }).code, email: null, name: null, maxUses: (data as { max_uses: number }).max_uses }],
  };
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
