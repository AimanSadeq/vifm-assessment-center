import Link from "next/link";
import { ArrowLeft, Aperture } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { ReflectWizard, type WizardOrg, type WizardTemplate } from "./_components/wizard";

export const metadata = {
  title: "New Reflect engagement",
};

async function fetchWizardData(): Promise<{ orgs: WizardOrg[]; templates: WizardTemplate[] }> {
  const sb = createServiceClient();
  const [orgsResult, templatesResult] = await Promise.all([
    sb.from("ara_organizations").select("id, name, name_ar, region, sector").order("name"),
    sb
      .from("reflect_frameworks")
      .select("id, name_en, name_ar, description_en, description_ar")
      .eq("is_template", true)
      .order("name_en"),
  ]);

  return {
    orgs: (orgsResult.data ?? []) as WizardOrg[],
    templates: (templatesResult.data ?? []) as WizardTemplate[],
  };
}

export default async function NewReflectEngagementPage() {
  const { orgs, templates } = await fetchWizardData();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link
              href="/reflect/consultant"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> Consultant dashboard
            </Link>
            <div className="flex items-center gap-2">
              <Aperture className="h-5 w-5 text-accent" />
              <h1 className="text-xl font-semibold text-primary">
                New Reflect engagement
              </h1>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">M2 · wizard</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <ReflectWizard orgs={orgs} templates={templates} />
      </main>
    </div>
  );
}
