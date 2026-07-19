"use server";

import { z } from "zod";
import { headers, cookies } from "next/headers";
import { redeemVoucher, normalizeCode } from "@/lib/ara/vouchers";

/** First-party cookie name binding this browser to its sitting for a given code. */
function resumeCookieName(code: string): string {
  return `arc_s_${normalizeCode(code).replace(/[^A-Z0-9]/g, "")}`;
}

const schema = z.object({
  code: z.string().min(4).max(40),
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
