import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Aperture, Layers } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type CompetencyWithBehaviors = {
  id: string;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  display_order: number;
  reflect_behaviors: Array<{
    id: string;
    text_en: string;
    text_ar: string | null;
    display_order: number;
    source: "manual" | "ai_proposed" | "ai_accepted";
  }>;
};

async function fetchTemplate(id: string) {
  const sb = createServiceClient();
  const { data: framework } = await sb
    .from("reflect_frameworks")
    .select(
      "id, name_en, name_ar, description_en, description_ar, is_template, is_active, created_at, " +
      "reflect_competencies(id, name_en, name_ar, description_en, description_ar, display_order, reflect_behaviors(id, text_en, text_ar, display_order, source))"
    )
    .eq("id", id)
    .eq("is_template", true)
    .maybeSingle<{
      id: string;
      name_en: string;
      name_ar: string | null;
      description_en: string | null;
      description_ar: string | null;
      is_template: boolean;
      is_active: boolean;
      created_at: string;
      reflect_competencies: CompetencyWithBehaviors[];
    }>();
  return framework;
}

export default async function ReflectTemplateDetailPage({ params }: Params) {
  const { id } = await params;
  const framework = await fetchTemplate(id);
  if (!framework) return notFound();
  const t = await getServerT();

  const competencies = framework.reflect_competencies
    .slice()
    .sort((a, b) => a.display_order - b.display_order);

  const totalBehaviors = competencies.reduce((s, c) => s + c.reflect_behaviors.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Link
            href="/reflect/admin/templates"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> {t("reflectAdmin.templates.title")}
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Aperture className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-semibold text-primary">{framework.name_en}</h1>
            {framework.name_ar && (
              <span className="text-sm text-muted-foreground" dir="rtl">
                {framework.name_ar}
              </span>
            )}
          </div>
          {framework.description_en && (
            <p className="text-xs text-muted-foreground max-w-2xl">
              {framework.description_en}
            </p>
          )}
          <div className="mt-3 inline-flex items-center gap-4 text-xs text-muted-foreground">
            <span><strong className="text-primary">{competencies.length}</strong> {t("reflectAdmin.templates.competencies")}</span>
            <span><strong className="text-primary">{totalBehaviors}</strong> {t("reflectAdmin.templates.behaviours")}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {competencies.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t("reflectAdmin.templateDetail.noCompetencies")}</p>
        ) : (
          competencies.map((c) => (
            <section key={c.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start gap-3">
                <Layers className="h-4 w-4 text-accent mt-1 shrink-0" />
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-primary">
                    {c.name_en}
                    {c.name_ar && (
                      <span className="ms-2 text-sm text-muted-foreground" dir="rtl">
                        {c.name_ar}
                      </span>
                    )}
                  </h2>
                  {c.description_en && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.description_en}</p>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {c.reflect_behaviors
                  .slice()
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((b) => (
                    <li key={b.id} className="text-sm flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-accent shrink-0" />
                      <div className="flex-1">
                        <div className="leading-relaxed">{b.text_en}</div>
                        {b.text_ar && (
                          <div dir="rtl" className="text-xs text-muted-foreground/80 mt-0.5">
                            {b.text_ar}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        )}

        <p className="text-[11px] text-muted-foreground pt-2">
          {t("reflectAdmin.templateDetail.footerNoteBefore")} <code className="text-[10px]">reflect_frameworks WHERE is_template = true</code>{t("reflectAdmin.templateDetail.footerNoteAfter")}
        </p>
      </main>
    </div>
  );
}
