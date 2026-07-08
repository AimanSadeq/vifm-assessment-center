import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { timingSafeStrEqual } from "@/lib/utils/secret";
import { sendEmail } from "@/lib/integrations/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/proposals/admin/renewals/cron - daily sweep that nudges the owner of
 * every issued/won LICENCE proposal whose 12-month renewal is within 60 days.
 * Bearer CRON_SECRET (GitHub Actions). Dedup via licence_data.renewalNoticeSentAt
 * so a proposal is nagged at most once per ~10-month window. Best-effort +
 * tolerant: if the licence columns aren't applied it simply processes nothing.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  const auth = req.headers.get("authorization") ?? "";
  if (!timingSafeStrEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://caliber.viftraining.com").replace(/\/$/, "");
  const svc = createServiceClient();
  const now = Date.now();
  const DAY = 86_400_000;

  let due = 0;
  let notified = 0;
  try {
    const { data, error } = await svc
      .from("proposals")
      .select("id, client_name, contact_email, sent_to, title, access_token, status, pricing_mode, issued_at, sent_at, created_at, licence_data")
      .eq("pricing_mode", "licence")
      .in("status", ["issued", "won"]);
    if (error) throw error;

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const base = (row.issued_at as string) || (row.sent_at as string) || (row.created_at as string);
      if (!base) continue;
      // The first renewal is base + 1 year; roll forward to the NEXT anniversary
      // at/after (now - 30d) so every yearly cycle (Y1->2, Y2->3, ...) is caught,
      // and a freshly-issued licence isn't reminded on day one.
      const renewal = new Date(base);
      renewal.setUTCFullYear(renewal.getUTCFullYear() + 1);
      while (renewal.getTime() < now - 30 * DAY) renewal.setUTCFullYear(renewal.getUTCFullYear() + 1);
      const daysUntil = (renewal.getTime() - now) / DAY;
      // Window: from 60 days before the upcoming anniversary to 30 days after.
      if (daysUntil > 60 || daysUntil < -30) continue;
      due += 1;

      const ld = (row.licence_data && typeof row.licence_data === "object" ? (row.licence_data as Record<string, unknown>) : {}) as Record<string, unknown>;
      const lastSent = typeof ld.renewalNoticeSentAt === "string" ? Date.parse(ld.renewalNoticeSentAt) : 0;
      if (lastSent && now - lastSent < 300 * DAY) continue; // already nagged this cycle

      const to = (row.contact_email as string) || (row.sent_to as string) || "";
      if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) continue;

      const ok = await sendEmail({
        to,
        template: "proposal_renewal_reminder",
        data: {
          clientName: (row.client_name as string) || "there",
          proposalTitle: (row.title as string) || "your VIFM licence",
          renewalDate: renewal.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
          viewUrl: `${appBase}/proposals/${row.access_token as string}`,
        },
      });
      if (ok) {
        notified += 1;
        await svc
          .from("proposals")
          .update({ licence_data: { ...ld, renewalNoticeSentAt: new Date(now).toISOString() }, updated_at: new Date(now).toISOString() })
          .eq("id", row.id as string);
      }
    }
  } catch (err) {
    // Tolerant: missing licence columns / table just yields nothing processed.
    console.error("[proposals/renewals/cron]", err);
    return NextResponse.json({ ok: true, due, notified, note: "no licence data available" });
  }

  return NextResponse.json({ ok: true, due, notified });
}
