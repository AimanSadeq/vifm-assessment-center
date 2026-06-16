import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { guardReflectEngagementAccess } from "@/lib/reflect/report-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reflect/engagements/[id]/needs-scheduling.csv
 *
 * Returns a CSV of every participant on this engagement whose debrief has
 * not yet been scheduled (debrief_status = 'not_scheduled'). Designed to
 * hand off to the ops team for Outlook booking.
 *
 * Columns: full_name, email, role_title, business_unit, level_tier,
 * language_preference, manager_email, participant_id.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Admin or the owning consultant only - this CSV is raw participant PII.
  const denied = await guardReflectEngagementAccess(id);
  if (denied) return denied;

  const sb = createServiceClient();

  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string }>();
  if (!engagement) {
    return NextResponse.json({ ok: false, error: "Engagement not found" }, { status: 404 });
  }

  const { data: rows } = await sb
    .from("reflect_participants")
    .select(
      "id, full_name, email, role_title, business_unit, level_tier, language_preference, manager_email, debrief_status"
    )
    .eq("engagement_id", id)
    .eq("debrief_status", "not_scheduled")
    .order("full_name");

  const header = [
    "full_name",
    "email",
    "role_title",
    "business_unit",
    "level_tier",
    "language_preference",
    "manager_email",
    "participant_id",
  ];

  const escape = (v: string | null | undefined) => {
    const s = v ?? "";
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [header.join(",")];
  for (const r of (rows ?? []) as Array<{
    id: string;
    full_name: string;
    email: string;
    role_title: string | null;
    business_unit: string | null;
    level_tier: string;
    language_preference: string;
    manager_email: string | null;
  }>) {
    lines.push(
      [
        escape(r.full_name),
        escape(r.email),
        escape(r.role_title),
        escape(r.business_unit),
        escape(r.level_tier),
        escape(r.language_preference),
        escape(r.manager_email),
        escape(r.id),
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `reflect-${engagement.name.replace(/[^a-zA-Z0-9]+/g, "_")}-needs-scheduling.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
