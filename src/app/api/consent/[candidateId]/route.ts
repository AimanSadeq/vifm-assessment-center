"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { candidateId: string } }
) {
  try {
    // Auth guard - the candidate who owns the record, or an admin (the admin
    // "view as candidate" flow). Ownership is verified against the candidate below.
    const caller = await getCurrentCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const consents = body.consents as {
      consent_type: string;
      consented: boolean;
    }[];

    if (!consents || !Array.isArray(consents)) {
      return NextResponse.json(
        { error: "Invalid consent data" },
        { status: 400 }
      );
    }

    // Validate all consents are true
    const allConsented = consents.every((c) => c.consented === true);
    if (!allConsented) {
      return NextResponse.json(
        { error: "All consent items must be accepted to proceed" },
        { status: 400 }
      );
    }

    // Writes go through the service client. The consent_records INSERT policy
    // only permits the candidate themselves, but this endpoint also serves the
    // admin "view as candidate" flow; the getUser() guard above still requires
    // an authenticated caller. (Matches the Academy/ARA service-role write path.)
    const svc = createServiceClient();

    // Validate candidate exists
    const { data: candidate } = await svc
      .from("candidates")
      .select("id, profile_id")
      .eq("id", params.candidateId)
      .maybeSingle<{ id: string; profile_id: string | null }>();

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    // Ownership: only the candidate who owns this record (or an admin) may consent.
    if (caller.role !== "admin" && candidate.profile_id !== caller.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotency: check if consent already exists for this candidate
    const { data: existing } = await svc
      .from("consent_records")
      .select("id")
      .eq("candidate_id", params.candidateId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    // Capture IP address for compliance audit trail
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? null;

    const rows = consents.map((c) => ({
      candidate_id: params.candidateId,
      consent_type: c.consent_type,
      consented: c.consented,
      consented_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ip_address: ipAddress,
    }));

    const { error } = await svc.from("consent_records").insert(rows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update candidate status to registered
    await svc
      .from("candidates")
      .update({ status: "registered" })
      .eq("id", params.candidateId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to process consent" },
      { status: 500 }
    );
  }
}
