// HiPo Engagement invitation email (server-only), via the shared Resend
// transport. Invites a line manager to the token-gated engagement survey.
// Best-effort: callers fall back to copy-link when email is unconfigured.
import { sendViaResend, resendConfigured } from "@/lib/integrations/resend";

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://caliber.viftraining.com"
  );
}

const wrap = (inner: string) => `
  <div dir="ltr" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#121232;text-align:left">
    <div style="background:#010131;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <div style="font-size:12px;letter-spacing:2px;color:#5391D5">VIFM</div>
      <div style="font-size:18px;font-weight:700">High-Potential Profile - Manager Survey</div>
    </div>
    <div style="border:1px solid #dbe3ec;border-top:0;border-radius:0 0 8px 8px;padding:20px">${inner}</div>
  </div>`;

/** Email the line manager their engagement-survey link. */
export async function emailEngagementInvitation(opts: {
  to: string;
  managerName: string;
  candidateName: string;
  url: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendConfigured()) return { ok: false, error: "Email not configured" };
  const html = wrap(`
    <p style="margin:0 0 12px">Dear ${opts.managerName},</p>
    <p style="margin:0 0 12px">As part of <b>${opts.candidateName}</b>'s VIFM High-Potential Profile, we would value your view as their line manager. The survey is <b>six short statements</b> and takes about three minutes.</p>
    <p style="margin:0 0 12px">Your answers feed the profile's Engagement reading. They are a management judgement, not a test of ${opts.candidateName} - please answer candidly based on what you observe.</p>
    <p style="margin:0 0 16px"><a href="${opts.url}" style="display:inline-block;background:#010131;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Open the survey</a></p>
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280">Or copy this link into your browser:</p>
    <p style="margin:0 0 12px;font-size:12px;color:#6b7280;word-break:break-all">${opts.url}</p>
    <p style="margin:0;font-size:12px;color:#6b7280">Virginia Institute of Finance and Management</p>
  `);
  return sendViaResend({
    to: opts.to,
    subject: `Three-minute manager survey for ${opts.candidateName}'s High-Potential Profile`,
    html,
  });
}
