// Resend HTTP API transport for APP-sent email (voucher invites, ARA results).
// Separate from Supabase Auth's SMTP (password resets) - this is for emails the
// app itself sends. Reuses the same Resend account/key.
//
// Env:
//   RESEND_API_KEY  - the re_... key (same one used for Supabase SMTP)
//   EMAIL_FROM      - sender, e.g. "VIFM Assessment Center <noreply@viftraining.com>"
//                     Until a domain is verified in Resend, use onboarding@resend.dev
//                     (which only delivers to your own Resend-account email).

export type EmailAttachment = { filename: string; content: string /* base64 */ };

export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "VIFM Assessment Center <onboarding@resend.dev>"
  );
}

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };

  const payload: Record<string, unknown> = {
    from: fromAddress(),
    to: [opts.to],
    subject: opts.subject,
  };
  if (opts.html) payload.html = opts.html;
  if (opts.text) payload.text = opts.text;
  if (!opts.html && !opts.text) payload.text = opts.subject;
  if (opts.attachments?.length) {
    payload.attachments = opts.attachments.map((a) => ({ filename: a.filename, content: a.content }));
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
