"use server";

import { z } from "zod";
import { headers, cookies } from "next/headers";
import { redeemVoucher, normalizeCode } from "@/lib/ara/vouchers";
import { createServiceClient } from "@/lib/supabase/server";
import { loadVoucherBlock } from "@/lib/vouchers/status";

/** First-party cookie name binding this browser to its sitting for a given code. */
function resumeCookieName(code: string): string {
  return `arc_s_${normalizeCode(code).replace(/[^A-Z0-9]/g, "")}`;
}

const schema = z.object({
  // Cleaned before the length check, so a code pasted with its link text
  // ("VIFM-ARC-XXXX-XXXX [caliber.viftraining.com]") still redeems.
  code: z.preprocess((v) => normalizeCode(String(v ?? "")), z.string().min(4, "Enter your voucher code.").max(40, "That does not look like a voucher code. It looks like VIFM-ARC-XXXX-XXXX.")),
  name: z.string().min(2).max(200),
  email: z.string().email().max(200),
  company: z.string().min(2).max(300),
});

/**
 * Public voucher redemption. No session - the delegate redeems a code, entering
 * name, email, and company (required, for future per-company insights). Returns
 * { ok, redirectTo } so the client component performs the redirect (calling
 * redirect() inside a server action mid-transition swallows the throw).
 */
export async function redeemVoucherAction(
  formData: FormData
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const h = headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent");

  // Browser-bound resume: pass the sitting id this browser was given when it
  // last redeemed THIS code (set as a first-party cookie below). This is what
  // lets re-opening the redeem link resume the in-progress sitting instead of
  // starting over - without trusting the typed email (which anyone could guess).
  const jar = cookies();
  const cookieName = resumeCookieName(parsed.data.code);
  const resumeRespondentId = jar.get(cookieName)?.value ?? null;

  const res = await redeemVoucher({
    code: parsed.data.code,
    redeemerName: parsed.data.name,
    redeemerEmail: parsed.data.email,
    companyName: parsed.data.company,
    ip,
    userAgent,
    resumeRespondentId,
  });

  if (!res.ok) return res;

  // Bind (or refresh) this browser to its sitting so a later re-open resumes it.
  try {
    jar.set(cookieName, res.respondentId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch {
    /* cookie write is best-effort - resume still works via the /ara/respond link */
  }

  return { ok: true, redirectTo: res.respondentUrl };
}

export type VoucherCodeCheck = {
  /** The code as the platform reads it (pasted link text stripped, upper-cased). */
  code: string;
  state: "ok" | "unknown" | "disabled" | "expired" | "used_up";
  /** The voucher's client name, so the form can offer it as the company. */
  company?: string;
};

/**
 * VOUCHER-12: check a TYPED code as soon as the delegate leaves the field, so a
 * mistyped, spent or expired code is flagged before they fill in the rest of
 * the form. Advisory only - the atomic claim RPC at submit remains the gate,
 * and loadVoucherBlock is never stricter than it.
 */
export async function checkVoucherCodeAction(raw: string): Promise<VoucherCodeCheck> {
  const code = normalizeCode(String(raw ?? "")).slice(0, 40);
  if (code.length < 4) return { code, state: "unknown" };
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("ara_vouchers")
      .select("client_name")
      .eq("code", code)
      .maybeSingle<{ client_name: string | null }>();
    if (!data) return { code, state: "unknown" };
    const block = await loadVoucherBlock("ara", code);
    return { code, state: block ? block.reason : "ok", company: data.client_name || undefined };
  } catch {
    return { code, state: "ok" }; // lookup failed - let the submit decide
  }
}
