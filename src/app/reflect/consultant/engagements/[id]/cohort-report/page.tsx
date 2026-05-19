import { notFound } from "next/navigation";
import { computeCohortScoring, type CohortScoring } from "@/lib/reflect/scoring";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
type SearchParams = Promise<{ bare?: string; lang?: string }>;

export default async function ReflectCohortReportPage({
  params,
  searchParams,
}: Params & { searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const scoring = await computeCohortScoring(id);
  if (!scoring) return notFound();

  const bare = sp.bare === "1";
  const lang: "en" | "ar" | "bilingual" =
    sp.lang === "ar" ? "ar" : sp.lang === "bilingual" ? "bilingual" : "en";

  return <CohortReport scoring={scoring} lang={lang} bare={bare} />;
}

function CohortReport({
  scoring,
  lang,
  bare,
}: {
  scoring: CohortScoring;
  lang: "en" | "ar" | "bilingual";
  bare: boolean;
}) {
  const rtl = lang === "ar";

  return (
    <div className={`reflect-pdf ${bare ? "bare" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      <style>{COHORT_CSS}</style>

      {/* Cover */}
      <section className="page cover">
        <div className="brand-stripe" />
        <div className="cover-inner">
          <div className="eyebrow">VIFM Reflect · 360° Cohort report</div>
          <h1>{scoring.engagement_name}</h1>
          <div className="role-title">{scoring.organization_name}</div>
          <dl className="cover-meta">
            <dt>{rtl ? "عدد المشاركين" : "Participants"}</dt>
            <dd>{scoring.participant_count}</dd>
            <dt>{rtl ? "عدد المقيّمين" : "Raters"}</dt>
            <dd>{scoring.rater_count}</dd>
            <dt>{rtl ? "عدد الإجابات" : "Responses"}</dt>
            <dd>{scoring.response_count}</dd>
            <dt>{rtl ? "تاريخ التقرير" : "Report date"}</dt>
            <dd>{new Date(scoring.generated_at).toLocaleDateString(rtl ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd>
          </dl>
          <div className="confidentiality">
            {rtl
              ? "سري وللاستخدام الداخلي لمكتب الموارد البشرية / كبير مسؤولي الموارد البشرية. لا يجوز توزيعه على المشاركين الأفراد."
              : "Confidential — for the HR / CHRO office's internal use. Not for distribution to individual participants."}
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="page">
        <h2>{rtl ? "الملخّص" : "Summary"}</h2>
        <div className="summary-grid">
          <KpiCard label={rtl ? "المعدّل العام للمجموعة" : "Cohort mean"} value={fmtScore(scoring.overall_mean)} sub={rtl ? "متوسط رأي الآخرين" : "Pooled Others view"} />
          <KpiCard label={rtl ? "المشاركون" : "Participants"} value={String(scoring.participant_count)} sub={rtl ? "في النطاق" : "in scope"} />
          <KpiCard label={rtl ? "المقيّمون" : "Raters"} value={String(scoring.rater_count)} sub={rtl ? "إجمالي" : "total"} />
          <KpiCard label={rtl ? "الإجابات" : "Responses"} value={String(scoring.response_count)} sub={rtl ? "تم استلامها" : "received"} />
        </div>

        <div className="two-col">
          <div>
            <h3 className="tone-strength-h3">{rtl ? "أعلى ثلاث كفايات" : "Top strengths"}</h3>
            <ol className="ranked">
              {scoring.top_strengths.map((s) => (
                <li key={s.competency_id}>
                  <span className="ranked-name">{rtl ? s.name_ar ?? s.name_en : s.name_en}</span>
                  <span className="ranked-value">{fmtScore(s.mean)}</span>
                </li>
              ))}
              {scoring.top_strengths.length === 0 && <li className="empty">—</li>}
            </ol>
          </div>
          <div>
            <h3 className="tone-develop-h3">{rtl ? "أعلى ثلاث مجالات تطوير" : "Top development areas"}</h3>
            <ol className="ranked">
              {scoring.top_development_areas.map((s) => (
                <li key={s.competency_id}>
                  <span className="ranked-name">{rtl ? s.name_ar ?? s.name_en : s.name_en}</span>
                  <span className="ranked-value">{fmtScore(s.mean)}</span>
                </li>
              ))}
              {scoring.top_development_areas.length === 0 && <li className="empty">—</li>}
            </ol>
          </div>
        </div>
      </section>

      {/* Heatmap */}
      <section className="page">
        <h2>{rtl ? "خريطة الكفايات حسب المشارك" : "Competency heatmap"}</h2>
        <div className="lead">
          {rtl
            ? "اللون يدل على المتوسط: الأخضر = أعلى، البرتقالي = منخفض. القيم بين 1 و5."
            : "Colour = mean rating. Green = high, orange = low. Values 1–5."}
        </div>
        <div className="heatmap-wrap">
          <table className="heatmap">
            <thead>
              <tr>
                <th className="hm-corner" />
                {scoring.competencies.map((c) => (
                  <th key={c.competency_id} className="hm-col-head" title={rtl ? c.name_ar ?? c.name_en : c.name_en}>
                    {(rtl ? c.name_ar ?? c.name_en : c.name_en).slice(0, 22)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoring.participants.map((p, idx) => (
                <tr key={p.participant_id}>
                  <td className="hm-row-head">{p.participant_name.slice(0, 24)}</td>
                  {scoring.competencies.map((c) => {
                    const cell = c.per_participant_means.find((x) => x.participant_id === p.participant_id);
                    const v = cell?.mean ?? null;
                    return (
                      <td key={c.competency_id} className={`hm-cell ${heatClass(v)}`}>
                        {v === null ? "—" : v.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-competency table */}
      <section className="page">
        <h2>{rtl ? "متوسط الكفايات على مستوى المجموعة" : "Competency means at the cohort level"}</h2>
        <table className="comp-table">
          <thead>
            <tr>
              <th>{rtl ? "الكفاية" : "Competency"}</th>
              <th className="num">{rtl ? "متوسط المجموعة" : "Cohort mean"}</th>
              <th className="num">{rtl ? "مشاركون مع بيانات" : "Participants with data"}</th>
            </tr>
          </thead>
          <tbody>
            {scoring.competencies.map((c) => {
              const counted = c.per_participant_means.filter((p) => p.mean !== null).length;
              return (
                <tr key={c.competency_id}>
                  <td>{rtl ? c.name_ar ?? c.name_en : c.name_en}</td>
                  <td className="num"><strong>{fmtScore(c.mean)}</strong></td>
                  <td className="num">{counted} / {scoring.participants.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function fmtScore(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(2);
}

function heatClass(v: number | null): string {
  if (v === null) return "hm-empty";
  if (v >= 4.2) return "hm-h5";
  if (v >= 3.8) return "hm-h4";
  if (v >= 3.4) return "hm-h3";
  if (v >= 3.0) return "hm-h2";
  return "hm-h1";
}

const COHORT_CSS = `
:root {
  --vifm-primary: #010131;
  --vifm-accent: #5391D5;
  --vifm-dark: #111232;
  --vifm-muted: #5A5A6A;
  --vifm-soft: #F4F6FB;
  --vifm-border: #E5EAF2;
  --tone-strength: #047857;
  --tone-develop: #B45309;
}
@page { size: A4; margin: 16mm 14mm 14mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.reflect-pdf {
  font-family: "Open Sans", "Segoe UI", Arial, sans-serif;
  color: var(--vifm-dark);
  font-size: 11pt;
  line-height: 1.5;
}
.reflect-pdf.bare nav, .reflect-pdf.bare aside { display: none !important; }
body > nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button], #__next-build-watcher { display: none !important; }
.page { page-break-after: always; break-after: page; padding: 8mm 4mm 0; }
.page:last-child { page-break-after: auto; break-after: auto; }
h1 { color: var(--vifm-primary); font-size: 26pt; font-weight: 700; margin: 0 0 4mm; line-height: 1.15; }
h2 { color: var(--vifm-primary); font-size: 18pt; font-weight: 700; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 1.2pt solid var(--vifm-accent); }
h3 { color: var(--vifm-primary); font-size: 12pt; font-weight: 700; margin: 4mm 0 2mm; }
.tone-strength-h3 { border-bottom: 0.6pt solid var(--tone-strength); padding-bottom: 1mm; color: var(--tone-strength); }
.tone-develop-h3 { border-bottom: 0.6pt solid var(--tone-develop); padding-bottom: 1mm; color: var(--tone-develop); }
.eyebrow { color: var(--vifm-accent); font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4mm; font-weight: 600; }
.lead { color: var(--vifm-muted); font-size: 10.5pt; margin: 0 0 5mm; }

.cover { padding: 0; position: relative; min-height: 260mm; }
.brand-stripe { height: 28mm; background: linear-gradient(135deg, var(--vifm-primary), var(--vifm-accent)); }
.cover-inner { padding: 14mm 14mm 0; }
.role-title { color: var(--vifm-muted); font-size: 12pt; margin-bottom: 12mm; }
.cover-meta { display: grid; grid-template-columns: 38mm 1fr; row-gap: 2mm; column-gap: 4mm; margin-bottom: 14mm; }
.cover-meta dt { color: var(--vifm-muted); font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; }
.cover-meta dd { margin: 0; font-size: 11pt; color: var(--vifm-dark); }
.confidentiality { background: var(--vifm-soft); border-radius: 3mm; padding: 4mm 5mm; color: var(--vifm-muted); font-size: 9.5pt; border-left: 3pt solid var(--vifm-accent); }

.summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 3mm; margin-bottom: 6mm; }
.kpi { border: 1px solid var(--vifm-border); border-radius: 2.5mm; padding: 3.5mm; }
.kpi-label { color: var(--vifm-muted); font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
.kpi-value { color: var(--vifm-primary); font-size: 22pt; font-weight: 700; line-height: 1.05; margin-top: 1.5mm; }
.kpi-sub { color: var(--vifm-muted); font-size: 8.5pt; margin-top: 1mm; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 4mm; }
.ranked { padding: 0; margin: 0; list-style: none; counter-reset: r; }
.ranked li { display: flex; justify-content: space-between; padding: 2.5mm 0; border-bottom: 0.6pt solid var(--vifm-border); font-size: 10.5pt; }
.ranked li:last-child { border-bottom: 0; }
.ranked-value { font-weight: 700; color: var(--vifm-primary); font-variant-numeric: tabular-nums; }
.empty { color: var(--vifm-muted); font-style: italic; }

.heatmap-wrap { overflow-x: auto; }
.heatmap { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.heatmap th, .heatmap td { padding: 1.5mm 1mm; border: 0.4pt solid #fff; text-align: center; }
.hm-corner { background: var(--vifm-soft); }
.hm-col-head { background: var(--vifm-soft); color: var(--vifm-primary); font-weight: 600; vertical-align: bottom; }
.hm-row-head { background: var(--vifm-soft); color: var(--vifm-dark); font-weight: 600; text-align: left; padding: 1.5mm 3mm; min-width: 40mm; }
.hm-cell { font-variant-numeric: tabular-nums; color: var(--vifm-dark); font-weight: 600; }
.hm-h5 { background: #BBF7D0; }
.hm-h4 { background: #D1FAE5; }
.hm-h3 { background: #FEF3C7; }
.hm-h2 { background: #FED7AA; }
.hm-h1 { background: #FECACA; }
.hm-empty { background: #F3F4F6; color: var(--vifm-muted); }

.comp-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
.comp-table th { background: var(--vifm-soft); color: var(--vifm-primary); padding: 2.5mm 3mm; text-align: left; font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; }
.comp-table th.num { text-align: right; }
.comp-table td { padding: 2.5mm 3mm; border-bottom: 0.6pt solid var(--vifm-border); }
.comp-table td.num { text-align: right; font-variant-numeric: tabular-nums; }

.reflect-pdf[dir="rtl"] .confidentiality { border-left: 0; border-right: 3pt solid var(--vifm-accent); }
.reflect-pdf[dir="rtl"] .hm-row-head { text-align: right; }
.reflect-pdf[dir="rtl"] .comp-table td.num, .reflect-pdf[dir="rtl"] .comp-table th.num { text-align: left; }
`;
