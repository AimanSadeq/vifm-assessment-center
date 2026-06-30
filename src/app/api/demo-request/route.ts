import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/integrations/email";

// Public lead-capture for the Caliber landing page "Request a demo" dialog.
// Validates name + email, then best-effort emails the VIFM team (console-mock
// when Microsoft Graph creds are absent). Auth-bypassed in middleware. The lead
// is never lost to a config gap - a failed notify still returns ok + logs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const str = (k: string) => String(body[k] ?? "").trim();
  const name = str("name");
  const email = str("email");
  if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Please provide a name and a valid work email." }, { status: 400 });
  }

  const organisation = str("organisation") || "-";
  const role = str("role") || "-";
  const phone = str("phone") || "-";
  const message = str("message") || "(none)";

  const salesAddress =
    process.env.VIFM_SALES_EMAIL ??
    process.env.OUTLOOK_SENDER_EMAIL ??
    process.env.EMAIL_FROM_ADDRESS ??
    null;

  try {
    if (salesAddress) {
      await sendEmail({
        to: salesAddress,
        template: "platform_demo_request",
        data: { name, email, organisation, role, phone, message },
      });
    } else {
      console.log(`[demo-request] (no VIFM_SALES_EMAIL) ${name} <${email}> · ${organisation} · ${role} · ${phone} :: ${message}`);
    }
  } catch (e) {
    console.warn("[demo-request] email notify failed:", e);
  }

  return NextResponse.json({ ok: true });
}
