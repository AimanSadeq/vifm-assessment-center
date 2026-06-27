"use server";

import { sendEmail } from "@/lib/integrations/email";
import { requireRole } from "@/lib/ara/auth-guards";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Email a whole batch of just-generated voucher links to ONE client address, so
// the client distributes them. Service-agnostic: the caller passes the already
// built redeem links, so this works for every voucher page. Admin-gated; sends
// via the shared Resend/Graph transport (console-mock when unconfigured).
export async function emailVoucherBatchToClientAction(input: {
  clientName: string;
  clientEmail: string;
  serviceLabel: string;
  items: { code: string; link: string }[];
}): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  const email = input.clientEmail.trim();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid client email address." };
  if (!input.items.length) return { error: "Generate some codes first, then email them to the client." };

  const links = input.items.map((it) => `${it.code}\n${it.link}`).join("\n\n");
  const ok = await sendEmail({
    to: email,
    template: "voucher_batch_to_client",
    data: {
      clientName: input.clientName.trim() || "there",
      serviceLabel: input.serviceLabel,
      count: String(input.items.length),
      links,
    },
  });
  return ok ? { ok: true } : { error: "The email could not be sent. Copy the links above and send them manually." };
}

// Email ONE personal link to each delegate (used by the wizard's "to delegates"
// path on every portal). Service-agnostic: caller pre-builds each delegate's
// redeem link. Admin-gated; best-effort per recipient.
export async function emailVoucherLinksToDelegatesAction(input: {
  serviceLabel: string;
  recipients: { email: string; name?: string; link: string }[];
}): Promise<{ ok: true; sent: number; total: number } | { error: string }> {
  await requireRole(["admin"]);
  const recips = input.recipients.filter((r) => EMAIL_RE.test((r.email ?? "").trim()));
  if (!recips.length) return { error: "No valid delegate email addresses." };
  let sent = 0;
  for (const r of recips) {
    const ok = await sendEmail({
      to: r.email.trim(),
      template: "voucher_to_delegate",
      data: { name: (r.name ?? "").trim() || "there", serviceLabel: input.serviceLabel, link: r.link },
    });
    if (ok) sent += 1;
  }
  return { ok: true, sent, total: recips.length };
}
