import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { canAccessReflectEngagement } from "@/lib/reflect/report-access";
import { loadReflectFrameworkForEngagement } from "@/lib/reflect/actions";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
type SearchParams = Promise<{ bare?: string; lang?: string }>;

export default async function ReflectFrameworkPreviewPage({
  params,
  searchParams,
}: Params & { searchParams: SearchParams }) {
  const { id } = await params;
  if (!(await canAccessReflectEngagement(id))) return notFound();
  const sp = await searchParams;

  const sb = createServiceClient();
  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select("id, name, ara_organizations(name)")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      name: string;
      ara_organizations: { name: string } | null;
    }>();
  if (!engagement) return notFound();

  const framework = await loadReflectFrameworkForEngagement(id);
  if (!framework) return notFound();

  const bare = sp.bare === "1";
  const lang: "en" | "ar" | "bilingual" =
    sp.lang === "ar" ? "ar" : sp.lang === "bilingual" ? "bilingual" : "en";
  const rtl = lang === "ar";

  const totalBehaviours = framework.competencies.reduce(
    (s, c) => s + c.behaviors.length,
    0
  );

  return (
    <div className={`framework-pdf ${bare ? "bare" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      <BackLink href="/reflect" label="Back" history />
      <style>{CSS}</style>

      {/* Cover */}
      <section className="page cover">
        <div className="brand-stripe" />
        <div className="cover-inner">
          <div className="eyebrow">Reflect 360® · Framework review</div>
          <h1>{engagement.name}</h1>
          <div className="role-title">{engagement.ara_organizations?.name ?? ""}</div>
          <dl className="cover-meta">
            <dt>{rtl ? "إطار العمل" : "Framework"}</dt>
            <dd>{rtl ? framework.framework.name_ar ?? framework.framework.name_en : framework.framework.name_en}</dd>
            <dt>{rtl ? "الكفايات" : "Competencies"}</dt>
            <dd>{framework.competencies.length}</dd>
            <dt>{rtl ? "السلوكيات" : "Behaviours"}</dt>
            <dd>{totalBehaviours}</dd>
            <dt>{rtl ? "تاريخ المراجعة" : "Review date"}</dt>
            <dd>{new Date().toLocaleDateString(rtl ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd>
          </dl>
          <div className="callout">
            {rtl
              ? "هذه نسخة المراجعة من إطار العمل قبل الإطلاق. شاركها مع العميل لاعتماد الكفايات والسلوكيات قبل إرسال الدعوات للمقيّمين."
              : "This is the pre-launch framework review. Share it with the client to sign off the competencies and behaviours before rater invitations go out."}
          </div>
        </div>
      </section>

      {/* Per-competency */}
      <section className="page no-break-after">
        <h2>{rtl ? "الكفايات والسلوكيات" : "Competencies & behaviours"}</h2>
        {framework.competencies.length === 0 ? (
          <p className="empty">{rtl ? "إطار العمل فارغ." : "Framework is empty."}</p>
        ) : (
          framework.competencies.map((c) => (
            <div key={c.id} className="comp-card">
              <h3>
                {rtl ? c.name_ar ?? c.name_en : c.name_en}
                {lang === "bilingual" && c.name_ar && (
                  <span className="comp-alt">{c.name_ar}</span>
                )}
              </h3>
              {(rtl ? c.description_ar : c.description_en) && (
                <p className="comp-desc">{rtl ? c.description_ar : c.description_en}</p>
              )}
              <ol className="behavior-list">
                {c.behaviors.map((b) => (
                  <li key={b.id}>
                    <span className="behavior-text">
                      {rtl ? b.text_ar ?? b.text_en : b.text_en}
                      {b.source === "ai_proposed" && (
                        <span className="ai-tag">{rtl ? "اقتراح ذكاء اصطناعي" : "AI-proposed"}</span>
                      )}
                      {lang === "bilingual" && b.text_ar && (
                        <span dir="rtl" className="behavior-alt">{b.text_ar}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const CSS = `
:root {
  --vifm-primary: #010131;
  --vifm-accent: #5391D5;
  --vifm-dark: #111232;
  --vifm-muted: #5A5A6A;
  --vifm-soft: #F4F6FB;
  --vifm-border: #E5EAF2;
}
@page { size: A4; margin: 16mm 14mm 14mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.framework-pdf {
  font-family: "Open Sans", "Segoe UI", Arial, sans-serif;
  color: var(--vifm-dark);
  font-size: 11pt;
  line-height: 1.5;
}
.framework-pdf.bare nav, .framework-pdf.bare aside { display: none !important; }
body > nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button] { display: none !important; }
.page { page-break-after: always; break-after: page; padding: 8mm 4mm 0; }
.page:last-child, .no-break-after { page-break-after: auto !important; break-after: auto !important; }
h1 { color: var(--vifm-primary); font-size: 26pt; font-weight: 700; margin: 0 0 4mm; line-height: 1.15; }
h2 { color: var(--vifm-primary); font-size: 18pt; font-weight: 700; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 1.2pt solid var(--vifm-accent); }
h3 { color: var(--vifm-primary); font-size: 12.5pt; font-weight: 700; margin: 3mm 0 1mm; display: flex; align-items: baseline; gap: 4mm; flex-wrap: wrap; }
.comp-alt { color: var(--vifm-muted); font-size: 10pt; font-weight: 500; }
.eyebrow { color: var(--vifm-accent); font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4mm; font-weight: 600; }

.cover { padding: 0; position: relative; min-height: 260mm; }
.brand-stripe { height: 28mm; background: linear-gradient(135deg, var(--vifm-primary), var(--vifm-accent)); }
.cover-inner { padding: 14mm 14mm 0; }
.role-title { color: var(--vifm-muted); font-size: 12pt; margin-bottom: 12mm; }
.cover-meta { display: grid; grid-template-columns: 38mm 1fr; row-gap: 2mm; column-gap: 4mm; margin-bottom: 14mm; }
.cover-meta dt { color: var(--vifm-muted); font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; }
.cover-meta dd { margin: 0; font-size: 11pt; color: var(--vifm-dark); }
.callout { background: var(--vifm-soft); border-radius: 3mm; padding: 4mm 5mm; color: var(--vifm-muted); font-size: 9.5pt; border-left: 3pt solid var(--vifm-accent); }

.comp-card { border: 1px solid var(--vifm-border); border-radius: 2.5mm; padding: 4mm; margin-bottom: 4mm; page-break-inside: avoid; }
.comp-desc { color: var(--vifm-muted); font-size: 10pt; margin: 1mm 0 2mm; }
.behavior-list { padding-left: 5mm; margin: 0; }
.behavior-list li { padding: 1.5mm 0; font-size: 10.5pt; }
.behavior-text { display: block; }
.behavior-alt { display: block; color: var(--vifm-muted); font-size: 9.5pt; margin-top: 0.5mm; }
.ai-tag { display: inline-block; margin-left: 2mm; font-size: 8pt; font-weight: 700; color: #6D28D9; background: #EDE9FE; border: 0.6pt solid #C4B5FD; padding: 0.3mm 1.4mm; border-radius: 4mm; text-transform: uppercase; letter-spacing: 0.04em; }
.empty { color: var(--vifm-muted); font-style: italic; }

.framework-pdf[dir="rtl"] .callout { border-left: 0; border-right: 3pt solid var(--vifm-accent); }
.framework-pdf[dir="rtl"] .behavior-list { padding-left: 0; padding-right: 5mm; }
.framework-pdf[dir="rtl"] .ai-tag { margin-left: 0; margin-right: 2mm; }
`;
