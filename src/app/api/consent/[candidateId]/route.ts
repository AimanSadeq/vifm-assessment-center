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

    const supabase = createServiceClient();

    const rows = consents.map((c) => ({
      candidate_id: params.candidateId,
      consent_type: c.consent_type,
      consented: c.consented,
      consented_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + 2 * 365 * 24 * 60 * 60 * 1000
      ).toISOString(), // 2-year retention
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
