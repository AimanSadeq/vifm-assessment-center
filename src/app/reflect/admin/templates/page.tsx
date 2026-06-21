import Link from "next/link";
import { ArrowLeft, Aperture, Layers, FileText } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reflect 360® · Library templates",
};

type TemplateRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  created_at: string;
  is_active: boolean;
  competency_count: number;
  behavior_count: number;
};

async function fetchTemplates(): Promise<TemplateRow[]> {
  const sb = createServiceClient();

  // Templates themselves
  const { data: templates } = await sb
    .from("reflect_frameworks")
    .select("id, name_en, name_ar, description_en, description_ar, created_at, is_active")
    .eq("is_template", true)
    .order("name_en");

  if (!templates || templates.length === 0) return [];

  // Per-template competency + behaviour counts.
  // Two narrow queries beat a `reflect_frameworks(*) -> reflect_competencies(*) -> reflect_behaviors(*)`
  // join because the join would materialise the whole framework tree just to count rows.
  const ids = templates.map((t) => t.id);
  const { data: comps } = await sb
    .from("reflect_competencies")
    .select("id, framework_id")
    .in("framework_id", ids);

  const compIds = (comps ?? []).map((c) => c.id);
  const { data: behs } =
    compIds.length === 0
      ? { data: [] as Array<{ id: string; competency_id: string }> }
      : await sb
          .from("reflect_behaviors")
          .select("id, competency_id")
          .in("competency_id", compIds);

  const competencyToFramework = new Map<string, string>();
  const compCountByFramework = new Map<string, number>();
  for (const c of (comps ?? []) as Array<{ id: string; framework_id: string }>) {
    competencyToFramework.set(c.id, c.framework_id);
    compCountByFramework.set(c.framework_id, (compCountByFramework.get(c.framework_id) ?? 0) + 1);
  }

  const behCountByFramework = new Map<string, number>();
  for (const b of (behs ?? []) as Array<{ id: string; competency_id: string }>) {
    const fwId = competencyToFramework.get(b.competency_id);
    if (!fwId) continue;
    behCountByFramework.set(fwId, (behCountByFramework.get(fwId) ?? 0) + 1);
  }

  return templates.map((t) => ({
    id: t.id,
    name_en: t.name_en,
    name_ar: t.name_ar,
    description_en: t.description_en,
    description_ar: t.description_ar,
    created_at: t.created_at,
    is_active: t.is_active,
    competency_count: compCountByFramework.get(t.id) ?? 0,
    behavior_count: behCountByFramework.get(t.id) ?? 0,
  }));
}

export default async function ReflectAdminTemplatesPage() {
  const templates = await fetchTemplates();
  // i18n binding named `tr` because the template list map below uses `t` as its row variable.
  const tr = await getServerT();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link
            href="/reflect/admin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> {tr("reflectAdmin.templates.backToAdmin")}
          </Link>
          <div className="flex items-center gap-2">
            <Aperture className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-semibold text-primary">{tr("reflectAdmin.templates.title")}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-sm text-muted-foreground max-w-2xl mb-8">
          {tr("reflectAdmin.templates.intro")}
        </p>

        {templates.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            {tr("reflectAdmin.templates.emptyBefore")} <code className="text-xs">00033_reflect_seed_template_framework.sql</code> {tr("reflectAdmin.templates.emptyAfter")}
          </div>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => (
              <li key={t.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Layers className="h-4 w-4 text-accent" />
                      <h2 className="text-base font-semibold text-primary">{t.name_en}</h2>
                      {t.name_ar && (
                        <span className="text-xs text-muted-foreground" dir="rtl">
                          {t.name_ar}
                        </span>
                      )}
                      {!t.is_active && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground border">
                          {tr("reflectAdmin.templates.inactive")}
                        </span>
                      )}
                    </div>
                    {t.description_en && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {t.description_en}
                      </p>
                    )}
                    <div className="mt-3 inline-flex items-center gap-4 text-xs text-muted-foreground">
                      <span><strong className="text-primary">{t.competency_count}</strong> {tr("reflectAdmin.templates.competencies")}</span>
                      <span><strong className="text-primary">{t.behavior_count}</strong> {tr("reflectAdmin.templates.behaviours")}</span>
                      <span>{tr("reflectAdmin.templates.created", { date: new Date(t.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) })}</span>
                    </div>
                  </div>
                  <Link
                    href={`/reflect/admin/templates/${t.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {tr("reflectAdmin.templates.view")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
