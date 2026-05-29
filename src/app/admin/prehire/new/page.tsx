import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { RequisitionForm } from "./_components/requisition-form";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const [profilesRes, orgsRes] = await Promise.all([
    supabase.from("role_profiles").select("id, name_en").order("name_en"),
    supabase.from("organizations").select("id, name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
      <BackLink href="/admin/prehire" label="Back to requisitions" />
      <div>
        <h1 className="text-2xl font-bold">New requisition</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the role, pick the screening stages, and set cut-scores.
        </p>
      </div>
      <RequisitionForm
        roleProfiles={(profilesRes.data ?? []) as { id: string; name_en: string }[]}
        organizations={(orgsRes.data ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
