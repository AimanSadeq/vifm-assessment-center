import { notFound } from "next/navigation";
import { computeCohortScoring, type CohortScoring } from "@/lib/reflect/scoring";
import {
  recommendCoursesForReflectCohort,
  HIGH_FIT_THRESHOLD,
  type RecommendedCourse,
} from "@/lib/recommender/courses";

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

  // Cohort training plan - best-effort. Empty list is fine; the page
  // hides the section entirely when nothing matched.
  const courses = await recommendCoursesForReflectCohort({
    engagementId: id,
    limit: 6,
  });

  const bare = sp.bare === "1";
  const lang: "en" | "ar" | "bilingual" =
    sp.lang === "ar" ? "ar" : sp.lang === "bilingual" ? "bilingual" : "en";

  return (
    <CohortReport
      scoring={scoring}
      recommendations={courses.recommendations}
      unmappedCompetencies={courses.unmapped}
      lang={lang}
      bare={bare}
    />
  );
}

function CohortReport({
  scoring,
  recommendations,
  unmappedCompetencies,
  lang,
  bare,
}: {
  scoring: CohortScoring;
  recommendations: RecommendedCourse[];
  unmappedCompetencies: string[];
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
          <div className="eyebrow">VIFM Reflect 360 · Cohort report</div>
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
              : "Confidential - for the HR / CHRO office's internal use. Not for distribution to individual participants."}
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
              {scoring.top_strengths.length === 0 && <li className="empty">-</li>}
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
              {scoring.top_development_areas.length === 0 && <li className="empty">-</li>}
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
                        {v === null ? "-" : v.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Distribution stacked-bars - % below/within/above Favorable Zone */}
      <section className="page">
        <h2>{rtl ? "توزيع القادة حول النطاق المرجعي" : "Where the cohort sits vs the Favorable Zone"}</h2>
        <p className="lead">
          {rtl
            ? "لكل كفاية، نسبة المشاركين الذين يقع متوسط آراء الآخرين عنهم تحت النطاق المرجعي (<3.5)، داخله (3.5–4.25)، أو فوقه (>4.25). البرامج التدريبية تستهدف عادةً الكفايات التي تظهر فيها شريحة حمراء كبيرة."
            : "For each competency, the share of participants whose Others-mean sits below the Favorable Zone (<3.5), within it (3.5–4.25), or above (>4.25). Training programmes typically target competencies showing a large red segment."}
        </p>
        <div className="dist-bars">
          {scoring.competencies.map((c) => {
            const d = c.distribution;
            const total = d.counted;
            const belowPct = total > 0 ? (d.below / total) * 100 : 0;
            const withinPct = total > 0 ? (d.within / total) * 100 : 0;
            const abovePct = total > 0 ? (d.above / total) * 100 : 0;
            return (
              <div key={c.competency_id} className="dist-row">
                <div className="dist-label">
                  {rtl ? c.name_ar ?? c.name_en : c.name_en}
                  <span className="dist-n">n={total}</span>
                </div>
                <div className="dist-track">
                  {total === 0 ? (
                    <em className="dist-empty">
                      {rtl ? "لا توجد بيانات بعد" : "No data yet"}
                    </em>
                  ) : (
                    <>
                      <span className="dist-below" style={{ width: `${belowPct}%` }}>
                        {belowPct >= 10 ? `${Math.round(belowPct)}%` : ""}
                      </span>
                      <span className="dist-within" style={{ width: `${withinPct}%` }}>
                        {withinPct >= 10 ? `${Math.round(withinPct)}%` : ""}
                      </span>
                      <span className="dist-above" style={{ width: `${abovePct}%` }}>
                        {abovePct >= 10 ? `${Math.round(abovePct)}%` : ""}
                      </span>
                    </>
                  )}
                </div>
                <div className="dist-counts">
                  {d.below}/{d.within}/{d.above}
                </div>
              </div>
            );
          })}
        </div>
        <div className="dist-legend">
          <span className="dist-legend-item"><span className="dist-swatch dist-below" /> {rtl ? "أقل من النطاق (<3.5)" : "Below zone (<3.5)"}</span>
          <span className="dist-legend-item"><span className="dist-swatch dist-within" /> {rtl ? "داخل النطاق (3.5–4.25)" : "Within zone (3.5–4.25)"}</span>
          <span className="dist-legend-item"><span className="dist-swatch dist-above" /> {rtl ? "أعلى من النطاق (>4.25)" : "Above zone (>4.25)"}</span>
        </div>
      </section>

      {/* P4.3 Cohort prior-delta - visible only when this is a reassessment */}
      {scoring.prior_overall_mean !== null && (
        <section className="page">
          <h2>{rtl ? "مقارنة بالتقييم السابق على مستوى المجموعة" : "Cohort delta vs prior assessment"}</h2>
          <p className="lead">
            {rtl
              ? `مقارنة بين هذه الدورة و: ${scoring.prior_engagement_name ?? "التقييم السابق"}. الأسهم الخضراء = تحسن، الحمراء = تراجع، الرمادية = ثبات (±0.2).`
              : `Comparison against ${scoring.prior_engagement_name ?? "the prior assessment"}. Green arrows = improvement, red = decline, grey = flat (±0.2).`}
          </p>

          <div className="cohort-delta-overall">
            <CohortPriorRow
              label={rtl ? "المعدّل العام للمجموعة" : "Cohort overall"}
              prior={scoring.prior_overall_mean}
              current={scoring.overall_mean}
              rtl={rtl}
              emphasis
            />
          </div>

          <h3>{rtl ? "حسب الكفاية" : "By competency"}</h3>
          {scoring.competencies.map((c) => (
            <CohortPriorRow
              key={c.competency_id}
              label={rtl ? c.name_ar ?? c.name_en : c.name_en}
              prior={c.prior_mean}
              current={c.mean}
              rtl={rtl}
            />
          ))}
        </section>
      )}

      {/* Cohort training plan - VIFM programmes ranked by aggregated gap */}
      {recommendations.length > 0 && (
        <section className="page">
          <h2>{rtl ? "خطة تطوير الكفايات على مستوى المجموعة" : "Cohort training plan"}</h2>
          <p className="lead">
            {rtl
              ? "برامج VIFM المُرشّحة بناءً على مجموع الفجوات في كل كفاية على مستوى المشاركين كلهم. هذه الترتيبات تجعل البرامج التي تخدم أكبر عدد من القادة في المقدّمة."
              : "VIFM programmes ranked by the aggregated gap across every participant - the programmes that serve the largest slice of the cohort sit at the top."}
          </p>
          <ol className="programme-list">
            {recommendations.map((p, i) => {
              const isHighFit = p.total_score >= HIGH_FIT_THRESHOLD;
              const topDriver = p.drivers.slice().sort((a, b) => b.contribution - a.contribution)[0];
              const courseSlug = p.course_code ?? p.course_id;
              const quoteUrl =
                `/courses/${encodeURIComponent(courseSlug)}/request-quote?source=reflect-cohort` +
                `&engagement=${scoring.engagement_id}`;
              return (
                <li key={p.course_id}>
                  <div className="programme-head">
                    <span className="programme-rank">{i + 1}</span>
                    <span className="programme-title">
                      {rtl ? p.title_ar ?? p.title_en : p.title_en}
                    </span>
                    {isHighFit && (
                      <span className="programme-fit">{rtl ? "★ مناسب جدًا" : "★ HIGH FIT"}</span>
                    )}
                  </div>
                  <div className="programme-meta">
                    {p.course_code && <span>{p.course_code}</span>}
                    <span>{p.vertical.replace(/_/g, " ")}</span>
                    <span>{rtl ? "المستوى" : "Level"}: {p.level}</span>
                    <span>{p.default_duration_days} {rtl ? "أيام" : "days"}</span>
                  </div>
                  <div className="programme-drivers">
                    {p.drivers.map((d, di) => (
                      <span key={di} className="programme-driver-chip">
                        {d.label}{" "}
                        <span className="programme-driver-math">
                          ({d.gap.toFixed(1)} × {d.relevance})
                        </span>
                      </span>
                    ))}
                  </div>
                  {topDriver?.rationale && (
                    <p className="programme-rationale">{topDriver.rationale}</p>
                  )}
                  <div className="programme-cta">
                    <a href={quoteUrl} className="programme-cta-link">
                      {rtl ? "اطلب عرض سعر ←" : "Request a quote →"}
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
          {unmappedCompetencies.length > 0 && (
            <div className="unmapped-detail">
              {rtl ? "كفايات لم تُربط: " : "Unmapped competencies: "}
              {unmappedCompetencies.join(" · ")}
            </div>
          )}
        </section>
      )}

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

/**
 * P4.3 cohort delta row. Renders "label: prior → current  ↑+0.4" with
 * a colour tone reflecting the delta size. Used in the bulk cohort-prior
 * page and once with emphasis=true for the headline overall row.
 */
function CohortPriorRow({
  label,
  prior,
  current,
  rtl,
  emphasis,
}: {
  label: string;
  prior: number | null;
  current: number | null;
  rtl: boolean;
  emphasis?: boolean;
}) {
  if (prior === null || current === null) {
    return (
      <div className={`cd-row cd-empty${emphasis ? " cd-emphasis" : ""}`}>
        <span className="cd-label">{label}</span>
        <span className="cd-missing">{rtl ? "لا توجد بيانات سابقة" : "no prior data"}</span>
      </div>
    );
  }
  const delta = current - prior;
  const sign = delta > 0 ? "+" : "";
  const tone = delta >= 0.2 ? "up" : delta <= -0.2 ? "down" : "flat";
  const arrow = tone === "up" ? "↑" : tone === "down" ? "↓" : "→";
  return (
    <div className={`cd-row cd-${tone}${emphasis ? " cd-emphasis" : ""}`}>
      <span className="cd-label">{label}</span>
      <span className="cd-prior">{prior.toFixed(2)}</span>
      <span className="cd-arrow">{arrow}</span>
      <span className="cd-current">{current.toFixed(2)}</span>
      <span className="cd-delta">{sign}{delta.toFixed(2)}</span>
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
  if (v === null) return "-";
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

/* P4.3 cohort delta rows */
.cohort-delta-overall { margin-bottom: 5mm; }
.cd-row { display: grid; grid-template-columns: 1fr 14mm 8mm 14mm 18mm; gap: 3mm; align-items: baseline; padding: 1.8mm 3mm; border-bottom: 0.5pt solid var(--vifm-border); font-size: 9.5pt; }
.cd-row:last-child { border-bottom: 0; }
.cd-emphasis { padding: 3mm; border: 1px solid var(--vifm-border); border-radius: 2mm; background: var(--vifm-soft); margin-bottom: 4mm; font-size: 11pt; }
.cd-emphasis .cd-label { font-weight: 700; color: var(--vifm-primary); }
.cd-label { color: var(--vifm-dark); }
.cd-prior, .cd-current, .cd-delta { font-variant-numeric: tabular-nums; text-align: right; }
.cd-prior { color: var(--vifm-muted); }
.cd-current { color: var(--vifm-primary); font-weight: 600; }
.cd-arrow { text-align: center; font-weight: 700; }
.cd-delta { font-weight: 700; padding: 0.2mm 1.5mm; border-radius: 2mm; }
.cd-up .cd-arrow, .cd-up .cd-delta { color: #047857; }
.cd-up .cd-delta { background: #D1FAE5; }
.cd-down .cd-arrow, .cd-down .cd-delta { color: #9F1239; }
.cd-down .cd-delta { background: #FEE2E2; }
.cd-flat .cd-arrow, .cd-flat .cd-delta { color: var(--vifm-muted); }
.cd-empty { color: var(--vifm-muted); font-style: italic; }
.cd-missing { grid-column: 2 / -1; text-align: right; font-size: 9pt; }

/* Cohort training plan - programme cards mirror the per-participant report */
.programme-list { padding: 0; margin: 0; list-style: none; }
.programme-list > li { padding: 4mm 0; border-bottom: 0.6pt solid var(--vifm-border); page-break-inside: avoid; }
.programme-list > li:last-child { border-bottom: 0; }
.programme-head { display: flex; align-items: baseline; gap: 3mm; flex-wrap: wrap; }
.programme-rank { display: inline-flex; align-items: center; justify-content: center; width: 6mm; height: 6mm; border-radius: 50%; background: var(--vifm-soft); color: var(--vifm-primary); font-size: 9pt; font-weight: 700; }
.programme-title { font-size: 11.5pt; font-weight: 700; color: var(--vifm-primary); }
.programme-fit { display: inline-block; font-size: 8pt; font-weight: 700; color: #047857; background: #D1FAE5; border: 0.6pt solid #6EE7B7; padding: 0.5mm 2mm; border-radius: 6mm; letter-spacing: 0.04em; }
.programme-meta { display: flex; gap: 4mm; flex-wrap: wrap; color: var(--vifm-muted); font-size: 9pt; margin: 1.5mm 0 2mm 9mm; text-transform: capitalize; }
.programme-drivers { display: flex; gap: 2mm; flex-wrap: wrap; margin-left: 9mm; }
.programme-driver-chip { display: inline-block; background: var(--vifm-soft); color: var(--vifm-primary); padding: 0.6mm 2.4mm; border-radius: 3mm; font-size: 9pt; }
.programme-driver-math { color: var(--vifm-muted); font-size: 8.5pt; }
.programme-rationale { margin: 2mm 0 0 9mm; color: var(--vifm-muted); font-size: 9pt; font-style: italic; }
.programme-cta { margin: 2.5mm 0 0 9mm; }
.programme-cta-link { color: var(--vifm-accent); font-size: 9.5pt; font-weight: 600; text-decoration: none; }
.unmapped-detail { margin-top: 3mm; color: var(--vifm-muted); font-size: 9pt; }
.reflect-pdf[dir="rtl"] .programme-meta,
.reflect-pdf[dir="rtl"] .programme-drivers,
.reflect-pdf[dir="rtl"] .programme-rationale,
.reflect-pdf[dir="rtl"] .programme-cta { margin-left: 0; margin-right: 9mm; }

/* Distribution stacked-bars */
.dist-bars { display: grid; gap: 2mm; margin-bottom: 4mm; }
.dist-row { display: grid; grid-template-columns: 55mm 1fr 18mm; gap: 3mm; align-items: center; font-size: 9.5pt; }
.dist-label { color: var(--vifm-dark); font-weight: 500; display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
.dist-n { color: var(--vifm-muted); font-size: 8.5pt; font-weight: 400; }
.dist-track { display: flex; height: 5mm; background: var(--vifm-soft); border-radius: 1mm; overflow: hidden; }
.dist-empty { color: var(--vifm-muted); font-style: italic; font-size: 9pt; padding: 0 2mm; align-self: center; }
.dist-below { background: #FCA5A5; }
.dist-within { background: #FCD34D; }
.dist-above { background: #6EE7B7; }
.dist-track > span { display: flex; align-items: center; justify-content: center; color: var(--vifm-dark); font-size: 8.5pt; font-weight: 600; min-width: 0; transition: width 0.2s; }
.dist-counts { color: var(--vifm-muted); font-size: 8.5pt; font-variant-numeric: tabular-nums; text-align: right; }
.dist-legend { display: flex; flex-wrap: wrap; gap: 5mm; margin-top: 3mm; background: var(--vifm-soft); padding: 3mm 4mm; border-radius: 2mm; font-size: 9pt; color: var(--vifm-muted); }
.dist-legend-item { display: inline-flex; align-items: center; gap: 1.5mm; }
.dist-swatch { display: inline-block; width: 4mm; height: 4mm; border-radius: 0.8mm; }

.reflect-pdf[dir="rtl"] .confidentiality { border-left: 0; border-right: 3pt solid var(--vifm-accent); }
.reflect-pdf[dir="rtl"] .hm-row-head { text-align: right; }
.reflect-pdf[dir="rtl"] .comp-table td.num, .reflect-pdf[dir="rtl"] .comp-table th.num { text-align: left; }
.reflect-pdf[dir="rtl"] .dist-counts { text-align: left; }
`;
