import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { PartnerCoursesManager, type PartnerCourseRow } from "./_components/manager";

export const dynamic = "force-dynamic";

export default async function PartnerCoursesPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return notFound();
    throw e;
  }

  const sb = createServiceClient();
  let rows: PartnerCourseRow[] = [];
  let tableMissing = false;
  const { data, error } = await sb
    .from("partner_courses")
    .select(
      "id, provider, provider_label, code, title_en, title_ar, description_en, cefr_levels, focus_skill, url, is_active, sort_order"
    )
    .order("provider", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) tableMissing = true;
  else rows = (data ?? []) as PartnerCourseRow[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/ac/fluent/cohort" label="Back to Fluent" />
      <h1 className="mt-4 text-2xl font-bold text-[#010131]">Partner English courses</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Curated partner programmes (e.g. SE Training Academy) shown on the Fluent placement report&rsquo;s
        recommendations, alongside VIFM&rsquo;s own catalogue. A course is suggested when its CEFR level suits the
        candidate&rsquo;s band - leave the level list empty to suit all levels. This source stays empty (and invisible
        on the report) until you add a course here.
      </p>

      {tableMissing ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-medium">Table not migrated yet.</div>
            <div className="mt-1 text-amber-800">
              Apply migration <code>00146_partner_courses.sql</code>, then reload this page to manage partner courses.
            </div>
          </div>
        </div>
      ) : (
        <PartnerCoursesManager rows={rows} />
      )}
    </div>
  );
}
