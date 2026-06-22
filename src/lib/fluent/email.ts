// Fluent voucher emails (server-only), via the shared Resend transport.
// Sends a delegate a one-click redeem link with their access code baked in.
// Best-effort: callers should not fail their flow if email fails.
// Bilingual EN/AR - the voucher's default_language drives the body.
import { sendViaResend, resendConfigured } from "@/lib/integrations/resend";

const wrap = (inner: string, rtl: boolean) => `
  <div dir="${rtl ? "rtl" : "ltr"}" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#121232;text-align:${rtl ? "right" : "left"}">
    <div style="background:#010131;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <div style="font-size:12px;letter-spacing:2px;color:#5391D5">VIFM</div>
      <div style="font-size:18px;font-weight:700">${rtl ? "اختبار الكفاءة في اللغة الإنجليزية" : "Fluent English Placement"}</div>
    </div>
    <div style="border:1px solid #dbe3ec;border-top:0;border-radius:0 0 8px 8px;padding:20px">${inner}</div>
  </div>`;

/** Email a delegate a ready-to-start Fluent redeem link (code baked into the URL). */
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
      <p style="margin:0 0 12px">لقد تمت دعوتك لإكمال اختبار <b>VIFM للكفاءة في اللغة الإنجليزية</b>. يُجرى في متصفحك ويقيس القراءة والاستماع والكتابة والتحدث.</p>
      <p style="margin:0 0 8px">رمز الدخول الخاص بك: <b style="font-family:monospace">${opts.code}</b></p>
      <p style="margin:0 0 20px">
        <a href="${opts.url}" style="background:#010131;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">ابدأ</a>
      </p>
      <p style="margin:0;font-size:12px;color:#5b6577">أو انسخ هذا الرابط: ${opts.url}</p>
    `,
      true
    );
    return sendViaResend({ to: opts.to, subject: "رمز الدخول إلى اختبار VIFM للكفاءة في اللغة الإنجليزية", html });
  }

  const hi = opts.name ? `Dear ${opts.name},` : "Hello,";
  const html = wrap(
    `
    <p style="margin:0 0 12px">${hi}</p>
    <p style="margin:0 0 12px">You have been invited to complete the <b>VIFM Fluent</b> English placement. It runs in your browser and assesses reading, listening, writing and speaking.</p>
    <p style="margin:0 0 8px">Your access code: <b style="font-family:monospace">${opts.code}</b></p>
    <p style="margin:0 0 20px">
      <a href="${opts.url}" style="background:#010131;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Start</a>
    </p>
    <p style="margin:0;font-size:12px;color:#5b6577">Or paste this link: ${opts.url}</p>
  `,
    false
  );
  return sendViaResend({ to: opts.to, subject: "Your VIFM Fluent English placement access", html });
}
