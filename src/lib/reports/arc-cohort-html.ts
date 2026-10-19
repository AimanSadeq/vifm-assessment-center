import { esc, vifmLogoColour, FONT_LINKS } from "@/lib/reports/sdc-hipo/brand";
import {
  ARA_INDIVIDUAL_FACTORS,
  ARA_INDIVIDUAL_MATURITY_STAGES,
  ARA_FACTOR_TONES,
  getFactorTone,
  getIndividualMaturityStage,
} from "@/lib/constants/ara-individual-factors";
import { MIN_NORM_SAMPLE } from "@/lib/ara/personal-norms";
import type { CompanyCohortInsight } from "@/lib/ara/company-cohort";
import type { RecommendedCourse } from "@/lib/recommender/courses";
export { cohortReportFilename } from "@/lib/ara/cohort-filenames";

/**
 * AI Readiness Compass: cohort report for one voucher company.
 *
 * The client-facing counterpart of the admin "Cohort insights" page. It stays
 * at the organizational level by decision (Aiman, 19 Oct 2026): completion,
 * cohort readiness overall and per factor, maturity spread, population
 * percentile and the recommended VIFM programs. No delegate names or
 * per-person scores; those stay in the admin CSV and the individual reports.
 *
 * Pure: HTML in, HTML out, so it can be tested without a browser. The PDF
 * route renders it with renderHtmlToPdfBuffer.
 */

const TARGET = 4;

function tone(score: number | null) {
  if (score == null) return { label: "No data", bg: "#f1f5f9", fg: "#475569", bar: "#cbd5e1" };
  const id = getFactorTone(score);
  const label = ARA_FACTOR_TONES[id].en;
  if (id === "strong") return { label, bg: "#dcfce7", fg: "#166534", bar: "#16a34a" };
  if (id === "developing") return { label, bg: "#fef3c7", fg: "#92400e", bar: "#d97706" };
  return { label, bg: "#fee2e2", fg: "#991b1b", bar: "#dc2626" };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One sentence per factor, written from the number, so the report never over-claims. */
function factorReading(name: string, avg: number | null, below: number, scored: number): string {
  if (avg == null) return `${name}: not enough answers to score yet.`;
  const id = getFactorTone(avg);
  if (id === "strong") {
    return `${name} is at or above the target of ${TARGET}.0. ${below === 0 ? "No scored delegate sits below the target here." : `${plural(below, "delegate")} of ${scored} still sit below the target, so the strength is not yet uniform.`}`;
  }
  if (id === "developing") {
    return `${name} is developing: the cohort averages ${avg.toFixed(1)}, with ${plural(below, "delegate")} of ${scored} below the target of ${TARGET}.0. This is the natural focus for a short program.`;
  }
  return `${name} is the cohort's main opportunity: an average of ${avg.toFixed(1)}, with ${plural(below, "delegate")} of ${scored} below the target of ${TARGET}.0. Development here will move the overall readiness most.`;
}

export function buildArcCohortReportHtml(args: {
  insight: CompanyCohortInsight;
  courses: RecommendedCourse[];
  generatedAt: string;
}): string {
  const { insight, courses, generatedAt } = args;
  const scored = insight.respondents.filter((r) => r.overall != null).length;
  const overallTone = tone(insight.cohort_overall);
  const stage = insight.cohort_overall != null ? getIndividualMaturityStage(insight.cohort_overall) : null;
  const logo = vifmLogoColour();
  const company = esc(insight.company_label);
  const mixedTier = insight.tier_counts.snapshot > 0 && insight.tier_counts.deep_dive > 0;

  const factors = ARA_INDIVIDUAL_FACTORS.map((f) => {
    const fa = insight.factor_averages.find((x) => x.factor_id === f.id);
    const avg = fa && fa.respondent_count > 0 ? fa.average : null;
    const below = fa?.below_target_count ?? 0;
    const n = fa?.respondent_count ?? 0;
    return { f, avg, below, n, t: tone(avg) };
  });
  // Weakest first for the reading; the cards keep the framework order.
  const readings = [...factors]
    .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))
    .map((x) => factorReading(x.f.name_en, x.avg, x.below, x.n));

  const bands = [
    { s: ARA_INDIVIDUAL_MATURITY_STAGES[2], range: "4.0 to 5.0", count: insight.band_distribution.embedded, color: "#16a34a" },
    { s: ARA_INDIVIDUAL_MATURITY_STAGES[1], range: "3.0 to 3.9", count: insight.band_distribution.practising, color: "#d97706" },
    { s: ARA_INDIVIDUAL_MATURITY_STAGES[0], range: "1.0 to 2.9", count: insight.band_distribution.emerging, color: "#dc2626" },
  ];

  const percentile =
    insight.norms_ready && insight.overall_percentile != null
      ? `This cohort's average sits around the <b>${insight.overall_percentile}th percentile</b> of all individual snapshots collected to date (n=${insight.norm_sample_size}).`
      : `Population percentiles are reported once at least ${MIN_NORM_SAMPLE} individual snapshots are collected (currently ${insight.norm_sample_size}). Until then, read the scores against the target of ${TARGET}.0.`;

  const courseRows = courses.slice(0, 5).map((c, i) => {
    const drivers = c.drivers
      .slice()
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2)
      .map((d) => esc(d.label))
      .join(", ");
    return `<tr><td class="num">${i + 1}</td><td><b>${esc(c.title_en)}</b>${c.course_code ? ` <span class="muted">${esc(c.course_code)}</span>` : ""}</td><td>${esc(c.level)}</td><td class="num">${c.default_duration_days} ${c.default_duration_days === 1 ? "day" : "days"}</td><td>${drivers || "-"}</td></tr>`;
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${company}: AI Readiness Compass cohort report</title>
${FONT_LINKS}
<style>
  @page { size: A4; margin: 14mm 15mm 16mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #0f172a; font-size: 10.5px; line-height: 1.45; margin: 0; }
  :root { --navy: #010131; --blue: #5391D5; --muted: #64748b; --line: #e2e8f0; }
  .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--navy); padding-bottom: 8px; margin-bottom: 14px; }
  .top .brand { font-size: 8.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--blue); text-align: right; line-height: 1.5; }
  h1 { font-size: 20px; color: var(--navy); margin: 0 0 2px; }
  h2 { font-size: 12.5px; color: var(--navy); margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--line); }
  .sub { color: var(--muted); font-size: 10px; margin: 0 0 10px; }
  .muted { color: var(--muted); }
  .pill { display: inline-block; border-radius: 999px; padding: 2px 9px; font-size: 9px; font-weight: 700; vertical-align: middle; }
  .glance { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap: 10px; }
  .box { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .box .big { font-size: 26px; font-weight: 700; color: var(--navy); line-height: 1; }
  .box .lab { font-size: 8.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin-bottom: 4px; }
  .box .small { font-size: 9.5px; color: var(--muted); margin-top: 4px; }
  .factors { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .factor .dom { font-size: 8.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .factor .name { font-size: 12px; font-weight: 700; margin: 2px 0; }
  .factor .desc { font-size: 9.5px; color: #334155; margin: 2px 0 6px; }
  .bar { height: 7px; background: #eef2f7; border-radius: 999px; overflow: hidden; margin-top: 6px; }
  .bar > div { height: 100%; border-radius: 999px; }
  .bands .row { display: grid; grid-template-columns: 170px 1fr 70px; gap: 10px; align-items: center; margin: 5px 0; }
  .note { background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; font-size: 9.5px; color: #334155; }
  ul.reading { margin: 4px 0 0 16px; padding: 0; } ul.reading li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); border-bottom: 1px solid var(--line); padding: 4px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; }
  .method p { margin: 3px 0; }
  .keep { break-inside: avoid; page-break-inside: avoid; }
  h2 { break-after: avoid; page-break-after: avoid; }
  .box, .row, tr { break-inside: avoid; page-break-inside: avoid; }
</style></head>
<body>
<div class="top">
  <div>${logo ? `<img src="${logo}" style="height:36px" alt="VIFM" />` : `<b style="color:var(--navy);font-size:16px">VIFM</b>`}</div>
  <div class="brand">AI Readiness Compass<br/>Cohort report</div>
</div>

<h1>${company}</h1>
<p class="sub">AI readiness across ${plural(insight.redeemed, "voucher delegate")}  |  ${esc(generatedAt)}
${insight.is_practice_only ? "  |  Practice data, not norm-referenced" : ""}${mixedTier ? `  |  Mixed tiers: ${insight.tier_counts.snapshot} snapshot, ${insight.tier_counts.deep_dive} deep-dive` : ""}</p>

<div class="glance">
  <div class="box">
    <div class="lab">Cohort AI readiness</div>
    ${insight.cohort_overall == null
      ? `<div class="big">-</div><div class="small">No delegate has answered enough items to score yet.</div>`
      : `<div><span class="big">${insight.cohort_overall.toFixed(1)}</span> <span class="muted">/ 5</span>
         <span class="pill" style="background:${overallTone.bg};color:${overallTone.fg};margin-left:6px">${esc(overallTone.label)}</span></div>
         <div class="small">Cohort stage: <b>${esc(stage?.name_en ?? "")}</b>${stage ? `, ${esc(stage.definition_en)}` : ""}</div>`}
  </div>
  <div class="box"><div class="lab">Redeemed</div><div class="big">${insight.redeemed}</div><div class="small">vouchers used</div></div>
  <div class="box"><div class="lab">Started</div><div class="big">${insight.started}</div><div class="small">opened the assessment</div></div>
  <div class="box"><div class="lab">Completed</div><div class="big">${insight.completed}</div><div class="small">${scored} scored</div></div>
</div>
<p class="note" style="margin-top:8px">${percentile}</p>

<h2>Readiness by factor</h2>
<div class="factors">
${factors.map(({ f, avg, below, n, t }) => `
  <div class="box factor">
    <div style="display:flex;align-items:center;gap:6px">
      <span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:${f.color}"></span>
      <span class="dom">${esc(f.domain)}</span>
      ${avg != null ? `<span class="pill" style="margin-left:auto;background:${t.bg};color:${t.fg}">${esc(t.label)}</span>` : ""}
    </div>
    <div class="name">${esc(f.name_en)}</div>
    <div class="desc">${esc(f.description_en)}</div>
    <div><span style="font-size:18px;font-weight:700;color:var(--navy)">${avg != null ? avg.toFixed(1) : "-"}</span> <span class="muted">/ 5</span>
      ${n > 0 ? `<span class="muted" style="margin-left:8px">${below} of ${n} below target</span>` : ""}</div>
    <div class="bar"><div style="width:${avg != null ? Math.round((avg / 5) * 100) : 0}%;background:${t.bar}"></div></div>
  </div>`).join("")}
</div>

<h2>What the numbers say</h2>
<ul class="reading">${readings.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>

${scored > 0 ? `
<div class="keep">
<h2>Maturity spread</h2>
<p class="sub" style="margin-bottom:4px">How the ${plural(scored, "scored delegate")} distribute across the readiness stages.</p>
<div class="bands">
${bands.map((b) => `
  <div class="row">
    <div><b>${esc(b.s.name_en)}</b> <span class="muted">(${b.range})</span></div>
    <div class="bar" style="margin:0"><div style="width:${Math.round((b.count / scored) * 100)}%;background:${b.color}"></div></div>
    <div class="muted" style="text-align:right">${b.count} of ${scored}</div>
  </div>`).join("")}
</div>
</div>` : ""}

<div class="keep">
<h2>Recommended VIFM programs</h2>
${courseRows.length
  ? `<p class="sub" style="margin-bottom:4px">Ranked by the cohort's weakest factors: the gap to the target of ${TARGET}.0 multiplied by each program's relevance to that factor.</p>
     <table><thead><tr><th>#</th><th>Program</th><th>Level</th><th>Length</th><th>Addresses</th></tr></thead><tbody>${courseRows.join("")}</tbody></table>`
  : `<p class="note">This cohort is at or near the target across all four factors. No training gap to close right now.</p>`}
</div>

<div class="keep">
<h2>How to read this report</h2>
<div class="method">
  <p>Each delegate completed the VIFM Personal AI Readiness Snapshot, which scores four factors of individual AI readiness on a 1 to 5 scale: ${ARA_INDIVIDUAL_FACTORS.map((f) => esc(f.name_en)).join(", ")}. The target for a confident, routine use of AI at work is ${TARGET}.0.</p>
  <p>Cohort figures are the average of the scored delegates. Readiness stages: ${bands.slice().reverse().map((b) => `<b>${esc(b.s.name_en)}</b> (${b.range}), ${esc(b.s.definition_en)}`).join("; ")}.</p>
  <p>The population percentile compares the cohort average with every individual snapshot collected on the platform to date. Scores describe self-reported and demonstrated readiness at the time of the assessment; they are a development signal, not a selection decision.</p>
  <p>Individual results are confidential to each delegate and are not listed here. Prepared by the Virginia Institute of Finance and Management on the Caliber platform.</p>
</div>
</div>
</body></html>`;
}
