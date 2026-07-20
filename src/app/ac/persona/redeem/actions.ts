"use server";

import { headers, cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeCode } from "@/lib/vouchers/codegen";
import { redeemVoucher } from "@/lib/persona/vouchers";

/** First-party cookie binding this browser to its sitting for a given code -
 *  the ARC pattern. Re-opening the redeem link on this device resumes the
 *  in-progress sitting instead of consuming another seat and reshuffling the
 *  questions (trial: Yassin closed the tab, came back seconds later, and got
 *  a brand-new sitting with different questions - his progress "lost" and a
 *  seat silently burned). */
function resumeCookieName(code: string): string {
  return `per_s_${normalizeCode(code).replace(/[^A-Z0-9]/g, "")}`;
}

// Server-side email shape check BEFORE the seat claim (trial: Asaad - the
// same gap he flagged on Fluent and Logica). An invalid address must never
// consume a voucher seat.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function redeemPersonaVoucherAction(input: {
  code: string;
  name: string;
  email: string;
  company: string;
}): Promise<{ ok: true; redemptionToken: string } | { ok: false; error: string }> {
  const email = (input.email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address so your result can be delivered." };
  }

  // Browser-bound resume BEFORE consuming a seat: if this browser already
  // redeemed this code and that sitting is not submitted, hand the same token
  // back. Ownership is proven by the httpOnly cookie, never by the typed email
  // (which anyone could guess).
  const jar = await cookies();
  const cookieName = resumeCookieName(input.code);
  const priorToken = jar.get(cookieName)?.value ?? null;
  if (priorToken) {
    try {
      const sb = createServiceClient();
      const { data: prior } = await sb
        .from("persona_voucher_redemptions")
        .select("id, redemption_token, voucher_id")
        .eq("redemption_token", priorToken)
        .maybeSingle<{ id: string; redemption_token: string; voucher_id: string }>();
      if (prior) {
        const { data: v } = await sb
          .from("persona_vouchers")
          .select("code")
          .eq("id", prior.voucher_id)
          .maybeSingle<{ code: string }>();
        const sameCode = v?.code && normalizeCode(v.code) === normalizeCode(input.code);
        if (sameCode) {
          const { data: submitted } = await sb
            .from("behavioral_assessment_sessions")
            .select("id")
            .eq("voucher_redemption_id", prior.id)
            .eq("status", "submitted")
            .maybeSingle<{ id: string }>();
          // Resume only an UNFINISHED sitting - a completed one falls through
          // to a normal redeem so the single-completion gate can answer.
          if (!submitted) return { ok: true, redemptionToken: prior.redemption_token };
        }
      }
    } catch {
      /* resume is best-effort - fall through to a fresh redeem */
    }
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = h.get("user-agent") || null;

  const res = await redeemVoucher({
    code: input.code,
    redeemerName: input.name,
    redeemerEmail: email,
    companyName: input.company,
    ip,
    userAgent,
  });
  if (!res.ok) return res;
  // Bind this browser to its sitting so a later re-open resumes it.
  try {
    jar.set(cookieName, res.redemptionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch {
    /* best-effort - resume still works via the /ac/persona/take link */
  }
  return { ok: true, redemptionToken: res.redemptionToken };
}
