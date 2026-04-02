import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { candidateId: string } }
) {
  try {
    // Auth guard — verify user is the candidate
    // TODO: When auth is enabled, verify auth.uid() matches candidate's profile_id
    // const supabase = await createClient();
    // const { data: { user } } = await supabase.auth.getUser();
    // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const supabase = createServiceClient();

    // Idempotency: check if consent already exists for this candidate
    const { data: existing } = await supabase
      .from("consent_records")
      .select("id")
      .eq("candidate_id", params.candidateId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already consented — just return success
      return NextResponse.json({ success: true });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 2); // Proper 2-year calculation

    const rows = consents.map((c) => ({
      candidate_id: params.candidateId,
      consent_type: c.consent_type,
      consented: c.consented,
      consented_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }));

    const { error } = await supabase.from("consent_records").insert(rows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update candidate status to registered
    await supabase
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
