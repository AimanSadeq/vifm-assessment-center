// Technical sandbox emails (server-only), via the shared Resend transport.
// Sends an access link/code to a delegate, and results + PDF on completion.
// Best-effort: callers should not fail their flow if email fails.
import { sendViaResend, resendConfigured } from "@/lib/integrations/resend";

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://caliber.viftraining.com"
  );
}

const wrap = (inner: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#121232">
    <div style="background:#010131;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <div style="font-size:12px;letter-spacing:2px;color:#5391D5">VIFM</div>
      <div style="font-size:18px;font-weight:700">Technical Assessment</div>
    </div>
    <div style="border:1px solid #dbe3ec;border-top:0;border-radius:0 0 8px 8px;padding:20px">${inner}</div>
  </div>`;

/** Email a delegate a ready-to-start link (direct link, or a voucher redeem link). */
export async function emailAccessLink(opts: {
  to: string;
  name?: string;
  functionName: string;
  url: string;
  code?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendConfigured()) return { ok: false, error: "Email not configured" };
  const hi = opts.name ? `Dear ${opts.name},` : "Hello,";
  const codeLine = opts.code
    ? `<p style="margin:0 0 8px">Your access code: <b style="font-family:monospace">${opts.code}</b></p>`
    : "";
  const html = wrap(`
    <p style="margin:0 0 12px">${hi}</p>
    <p style="margin:0 0 12px">You've been invited to complete the <b>${opts.functionName}</b> technical assessment.</p>
    ${codeLine}
    <p style="margin:0 0 16px">It is timed once you begin, and runs in your browser.</p>
    <p style="margin:0 0 20px">
      <a href="${opts.url}" style="background:#010131;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Start the assessment</a>
    </p>
    <p style="margin:0;font-size:12px;color:#5b6577">Or paste this link: ${opts.url}</p>
  `);
  return sendViaResend({
    to: opts.to,
    subject: `VIFM Technical Assessment — ${opts.functionName}`,
    html,
  });
}

/** Email results with the PDF report attached. */
export async function emailResults(opts: {
  to: string;
  name?: string;
  functionName: string;
  overallPct: number;
  overallBand: string;
  pdfBase64: string;
  fileName: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendConfigured()) return { ok: false, error: "Email not configured" };
  const hi = opts.name ? `Dear ${opts.name},` : "Hello,";
  const band = opts.overallBand.charAt(0).toUpperCase() + opts.overallBand.slice(1);
  const html = wrap(`
    <p style="margin:0 0 12px">${hi}</p>
    <p style="margin:0 0 12px">Thank you for completing the <b>${opts.functionName}</b> technical assessment.</p>
    <p style="margin:0 0 12px">Overall result: <b>${opts.overallPct}%</b> &middot; <b>${band}</b>.</p>
    <p style="margin:0 0 12px">Your full breakdown (per competency, with development pointers) is attached as a PDF.</p>
    <p style="margin:0;font-size:12px;color:#5b6577">${appOrigin()}</p>
  `);
  return sendViaResend({
    to: opts.to,
    subject: `Your VIFM Technical Assessment results — ${opts.functionName}`,
    html,
    attachments: [{ filename: opts.fileName, content: opts.pdfBase64 }],
  });
}
