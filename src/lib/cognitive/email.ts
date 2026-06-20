// Cognitive voucher emails (server-only), via the shared Resend transport.
// Sends a delegate a one-click redeem link with their access code baked in.
// Best-effort: callers should not fail their flow if email fails.
// Bilingual EN/AR - the voucher's default_language drives the body.
import { sendViaResend, resendConfigured } from "@/lib/integrations/resend";

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://caliber.viftraining.com"
  );
}

const wrap = (inner: string, rtl: boolean) => `
  <div dir="${rtl ? "rtl" : "ltr"}" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#121232;text-align:${rtl ? "right" : "left"}">
    <div style="background:#010131;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <div style="font-size:12px;letter-spacing:2px;color:#5391D5">VIFM</div>
      <div style="font-size:18px;font-weight:700">${rtl ? "تقييم الاستدلال" : "Reason Assessment"}</div>
    </div>
    <div style="border:1px solid #dbe3ec;border-top:0;border-radius:0 0 8px 8px;padding:20px">${inner}</div>
  </div>`;

/** Email a delegate a ready-to-start Cognitive redeem link (code baked into the URL). */
export async function emailVoucherLink(opts: {
  to: string;
  name?: string;
  code: string;
  url: string;
  lang?: "en" | "ar";
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendConfigured()) return { ok: false, error: "Email not configured" };
  const ar = opts.lang === "ar";

  if (ar) {
    const hi = opts.name ? `عزيزي/عزيزتي ${opts.name}،` : "مرحبا،";
    const html = wrap(
      `
      <p style="margin:0 0 12px">${hi}</p>
      <p style="margin:0 0 12px">لقد تمت دعوتك لإكمال تقييم <b>VIFM للاستدلال</b>. يستغرق وقتا قصيرا ويُجرى في متصفحك، ويكون مؤقتا بمجرد البدء.</p>
      <p style="margin:0 0 8px">رمز الدخول الخاص بك: <b style="font-family:monospace">${opts.code}</b></p>
      <p style="margin:0 0 20px">
        <a href="${opts.url}" style="background:#010131;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">ابدأ</a>
      </p>
      <p style="margin:0;font-size:12px;color:#5b6577">أو انسخ هذا الرابط: ${opts.url}</p>
    `,
      true
    );
    return sendViaResend({ to: opts.to, subject: "رمز الدخول إلى تقييم VIFM للاستدلال", html });
  }

  const hi = opts.name ? `Dear ${opts.name},` : "Hello,";
  const html = wrap(
    `
    <p style="margin:0 0 12px">${hi}</p>
    <p style="margin:0 0 12px">You have been invited to complete the <b>VIFM Reason</b> assessment. It is short, timed once you begin, and runs in your browser.</p>
    <p style="margin:0 0 8px">Your access code: <b style="font-family:monospace">${opts.code}</b></p>
    <p style="margin:0 0 20px">
      <a href="${opts.url}" style="background:#010131;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Start</a>
    </p>
    <p style="margin:0;font-size:12px;color:#5b6577">Or paste this link: ${opts.url}</p>
  `,
    false
  );
  return sendViaResend({ to: opts.to, subject: "Your VIFM Reason assessment access", html });
}
