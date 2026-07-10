import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Aperture } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getServerT } from "@/lib/i18n/server";
import { resolvePlanOrgId } from "@/lib/start/resolve-plan-org";
import { ReflectWizard, type WizardOrg, type WizardTemplate } from "./_components/wizard";

export const metadata = {
  title: "New Reflect 360® engagement",
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

export default async function NewReflectEngagementPage({
  searchParams,
}: {
  searchParams?: { org?: string; orgName?: string };
}) {
  // Self-gate: this page uses the service-role client (bypassing RLS) to load
  // the full ara_organizations registry + all templates. There is no
  // reflect/consultant layout role-gate, and middleware enforces auth NOT role,
  // so without this any logged-in user (e.g. a candidate) could read the whole
  // client list. Consultant or admin only, mirroring every sibling page.
  const caller = await getCurrentCaller();
  if (!caller || (caller.role !== "consultant" && caller.role !== "admin")) notFound();

  const { orgs, templates } = await fetchWizardData();
  const t = await getServerT();
  const defaultOrgId = resolvePlanOrgId(orgs, searchParams);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link
              href="/reflect/consultant"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> {t("reflectWizard.page.backToDashboard")}
            </Link>
            <div className="flex items-center gap-2">
              <Aperture className="h-5 w-5 text-accent" />
              <h1 className="text-xl font-semibold text-primary">
                {t("reflectWizard.page.title")}
              </h1>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{t("reflectWizard.page.badge")}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <ReflectWizard orgs={orgs} templates={templates} defaultOrgId={defaultOrgId} />
      </main>
    </div>
  );
}
