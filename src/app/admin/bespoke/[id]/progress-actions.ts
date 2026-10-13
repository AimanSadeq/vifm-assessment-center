"use server";

// Progress and follow-up actions for one bundle (00237, Ali's recommendations
// of 13 Oct 2026): deadline and follow-up settings, the code's closing date,
// logging a chase, marking testers, the contact history of one person, and
// the optional invitation and reminder emails.
import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadBundleService } from "@/lib/bespoke/services";
import { saveBundleSettings, loadBundleSettings, formatCompleteBy } from "@/lib/bespoke/bundle-settings";
import { setBundleVoucherExpiry, loadBundleVouchers } from "@/lib/bespoke/bundle-vouchers";
import { firstWord } from "@/lib/bespoke/progress-shared";
import { sendEmail } from "@/lib/integrations/email";
import { siteOrigin } from "@/lib/site-url";
import { setRosterTester } from "@/lib/bespoke/roster";
import { logContacts, loadContactHistory, CONTACT_CHANNELS, type ContactChannel, type ContactHistoryRow } from "@/lib/bespoke/contact-log";
import { normalizeVoucherExpiry } from "@/lib/vouchers/expiry";

async function guard(bundleId: string) {
  try {
    const caller = await requireRole(["admin"]);
    const bundle = await loadBundleService(bundleId);
    if (!bundle) return { ok: false as const, error: "Bundle not found." };
    return { ok: true as const, caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

const done = (bundleId: string) => revalidatePath(`/admin/bespoke/${bundleId}`);
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Complete-by date (a calendar day, or empty for none), follow-up threshold
 *  and the email switch. */
export async function saveScheduleAction(
  bundleId: string,
  input: { completeBy: string; followupDays: number; emailsEnabled: boolean },
): Promise<{ ok: true } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const day = (input.completeBy ?? "").trim();
  if (day && !BARE_DATE.test(day)) return { error: "Choose a complete-by date." };
  const days = Math.round(Number(input.followupDays));
  if (!Number.isFinite(days) || days < 1 || days > 30) return { error: "Follow-up after must be 1 to 30 days." };
  const res = await saveBundleSettings(
    bundleId,
    { completeBy: day ? normalizeVoucherExpiry(day) : null, followupDays: days, emailsEnabled: !!input.emailsEnabled },
    g.caller.uid,
  );
  if ("error" in res) return { error: /column/i.test(res.error) ? "Apply migration 00237 first." : res.error };
  done(bundleId);
  return { ok: true };
}

/** Closing date for a bundle code: a calendar day (end of that day), or empty
 *  to keep it open. */
export async function setVoucherExpiryAction(bundleId: string, voucherId: string, day: string): Promise<{ ok: true } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const v = (day ?? "").trim();
  if (v && !BARE_DATE.test(v)) return { error: "Choose a closing date." };
  const res = await setBundleVoucherExpiry(bundleId, voucherId, v ? normalizeVoucherExpiry(v) : null);
  if ("error" in res) return res;
  done(bundleId);
  return { ok: true };
}

export async function setTesterAction(bundleId: string, rosterId: string, isTester: boolean): Promise<{ ok: true } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const res = await setRosterTester(bundleId, rosterId, isTester);
  if ("error" in res) return res;
  done(bundleId);
  return { ok: true };
}

/** Record that people were chased outside the platform (phone, WhatsApp, the
 *  client), so the follow-up list stops flagging them for a while. */
export async function logChaseAction(
  bundleId: string,
  people: Array<{ rosterId: string | null; candidateId: string | null; email: string }>,
  channel: string,
  note: string,
): Promise<{ ok: true; count: number } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  if (!(CONTACT_CHANNELS as readonly string[]).includes(channel)) return { error: "Choose how they were contacted." };
  const res = await logContacts(
    bundleId,
    people.map((p) => ({ ...p, kind: "manual" as const, channel: channel as ContactChannel, note })),
    g.caller.uid,
  );
  if ("error" in res) return { error: /relation|does not exist/i.test(res.error) ? "Apply migration 00237 first." : res.error };
  done(bundleId);
  return res;
}

export async function contactHistoryAction(bundleId: string, email: string): Promise<{ ok: true; rows: ContactHistoryRow[] } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  return { ok: true, rows: await loadContactHistory(bundleId, email) };
}

/** Invitation or reminder emails from the platform (00237). Refused unless the
 *  bundle's email switch is on. Each send is logged, failed ones too. */
export async function sendBundleEmailsAction(
  bundleId: string,
  people: Array<{ rosterId: string | null; candidateId: string | null; email: string; name: string; started: boolean }>,
  kind: "invite" | "reminder",
): Promise<{ ok: true; sent: number; failed: number } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  if (people.length === 0) return { error: "Select at least one person." };
  if (people.length > 300) return { error: "Up to 300 emails at a time." };
  const [bundle, settings, vouchers] = await Promise.all([
    loadBundleService(bundleId),
    loadBundleSettings(bundleId),
    loadBundleVouchers(bundleId),
  ]);
  if (!settings.emailsEnabled) return { error: "Emails are switched off for this assessment. Switch them on under Deadline and reminders first." };
  if (settings.held) return { error: "The assessment is on hold. Release it before emailing people." };
  const pool = vouchers.find((v) => v.max_uses > 1);
  if (!pool) return { error: "Create the shared link for this assessment first." };
  const link = `${siteOrigin()}/bundle/redeem?code=${pool.code}`;
  const due = formatCompleteBy(settings.completeBy);

  let sent = 0;
  let failed = 0;
  const log: Parameters<typeof logContacts>[1] = [];
  // Small batches keep within the mail provider's rate limits.
  for (let i = 0; i < people.length; i += 5) {
    const batch = people.slice(i, i + 5);
    const results = await Promise.all(
      batch.map((p) =>
        sendEmail({
          to: p.email,
          template: kind === "invite" ? "bundle_invitation" : "bundle_reminder",
          data: {
            firstName: firstWord(p.name) || "colleague",
            assessmentName: bundle!.name_en,
            email: p.email,
            link,
            completeByLine: due ? ` Please complete it by ${due}.` : "",
            progressLine: p.started ? "Your answers so far are saved, so you will continue where you stopped." : "It can be completed in more than one sitting; your answers are saved as you go.",
          },
        }).catch(() => false),
      ),
    );
    results.forEach((ok, j) => {
      const p = batch[j];
      if (ok) sent += 1;
      else failed += 1;
      log.push({ rosterId: p.rosterId, candidateId: p.candidateId, email: p.email, kind: kind === "invite" ? "email_invite" : "email_reminder", channel: "email", note: null, ok });
    });
  }
  await logContacts(bundleId, log, g.caller.uid);
  done(bundleId);
  return { ok: true, sent, failed };
}
