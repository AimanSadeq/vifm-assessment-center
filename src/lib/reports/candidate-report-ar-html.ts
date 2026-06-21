/**
 * Arabic / RTL HTML renderer for the 6-page VIFM candidate Talent
 * Assessment Report. Pairs with React-PDF for English in the same
 * route (src/app/api/reports/[engagementId]/[candidateId]/route.tsx):
 *
 *   ar  → renderCandidateReportHtmlAr → Puppeteer page.setContent → PDF
 *   en  → existing React-PDF CandidateReport component
 *
 * React-PDF cannot shape Arabic glyphs (no harfbuzz / no font fallback),
 * which is why the EN path stays on it and the AR path goes via a
 * Chromium render - Chrome's text engine has full bidi + Arabic shaping
 * out of the box, so all we need to do is serve well-formed RTL HTML
 * with a real Arabic font loaded.
 *
 * Layout intentionally mirrors the React-PDF EN six-page layout so the
 * two versions feel like the same report:
 *
 *   Page 1 - Cover (navy hero, confidential strip, assessment summary)
 *   Page 2 - About the Assessment Centre (methodology + BARS scale +
 *            exercises completed + how to use)
 *   Page 3 - Summary (stat tiles, OAR callout, competency rating bars
 *            with gap pills, key strengths / development chips)
 *   Page 4 - Competency Detail (per-competency cards: exercise ratings,
 *            observed strengths, development areas, suggested actions)
 *   Page 5 - Development Recommendations (table)
 *
 * The competency-detail section flows across pages naturally
 * (page-break-inside:avoid on each card), so a long competency list
 * pushes the report to six+ physical pages while the logical sections
 * stay in the same order as the EN report.
 *
 * Reuses the SAME `ReportData` type the route passes to the React-PDF
 * component (no parallel data shape). The route builds that data once;
 * we just render it in Arabic.
 *
 * ⚠️  Arabic competency / cluster / domain NAMES come straight from the
 * DB via `ReportData`, which today carries only the English `name`
 * columns (see fetch-report-data.ts). When those tables grow `_ar`
 * name columns and the fetcher surfaces them, the chrome here is
 * already Arabic - only the proper nouns would switch. The static
 * Arabic copy (headings, BARS labels, methodology prose) lives in this
 * file so a translator can update it in one place. Per CLAUDE.md's
 * "Important Notes", Arabic competency translations are placeholders
 * pending native review; that warning extends to this file's prose.
 */

import type { ReportData } from "./report-types";
import { AR_FONT_HREF, escapeHtml as esc } from "@/lib/reports/html-to-pdf";
import { GAP_TONES, DEFAULT_TARGET, type GapSeverity } from "@/lib/scoring/competency-gap";

// ────────────────────────────────────────────────────────────────
// Arabic BARS + OAR labels (the only domain enums the report renders).
// ────────────────────────────────────────────────────────────────
const BARS_AR: Record<number, string> = {
  1: "حاجة كبيرة للتطوير",
  2: "حاجة للتطوير",
  3: "كفؤ",
  4: "نقطة قوة",
  5: "نقطة قوة كبيرة",
};

const OAR_LABELS_AR: Record<string, string> = {
  ready_now: "جاهز الآن",
  ready_with_development: "جاهز مع التطوير",
  not_ready: "غير جاهز",
};

const EXERCISE_LABELS_AR: Record<string, string> = {
  in_basket: "صندوق الوارد / البريد الإلكتروني",
  role_play: "لعب الأدوار",
  group_exercise: "تمرين جماعي",
  case_study: "دراسة حالة",
  oral_presentation: "عرض شفهي",
  competency_based_interview: "مقابلة قائمة على الكفاءات",
};

// ────────────────────────────────────────────────────────────────
// Arabic gap-severity badge. Mirrors getCompetencyGap() from
// competency-gap.ts (same gap = target - score arithmetic, same
// six-tier severity) but emits Arabic labels. Tone colours are reused
// from GAP_TONES so the AR + EN reports share the exact palette.
// ────────────────────────────────────────────────────────────────
function gapBadgeAr(
  score: number | null | undefined,
  target: number = DEFAULT_TARGET
): { severity: GapSeverity; label: string } | null {
  if (score == null || !Number.isFinite(score)) return null;
  const t = Math.round(target);
  const s = Math.round(score);
  const gap = t - s;

  if (gap >= 3) return { severity: "significant_gap", label: `فجوة كبيرة (${gap} مستويات)` };
  if (gap === 2) return { severity: "moderate_gap", label: "فجوة متوسطة (مستويان)" };
  if (gap === 1) return { severity: "minor_gap", label: "فجوة طفيفة (مستوى واحد)" };
  if (gap === 0) return { severity: "on_target", label: "ضمن المستهدف" };
  if (gap === -1) return { severity: "strength", label: "نقطة قوة" };
  return { severity: "significant_strength", label: "نقطة قوة كبيرة" };
}

function gapPillHtml(score: number | null | undefined): string {
  const g = gapBadgeAr(score);
  if (!g) return "";
  const tone = GAP_TONES[g.severity];
  return `<span class="gap-pill" style="background:${tone.bg};color:${tone.fg};border-color:${tone.border}">${esc(g.label)}</span>`;
}

// ────────────────────────────────────────────────────────────────
// VIFM brand palette + the five maturity-band bar colours (1→5),
// kept in sync with candidate-report.tsx.
// ────────────────────────────────────────────────────────────────
const C = {
  primary: "#010131",
  accent: "#5391D5",
  navy: "#121140",
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  bgSoft: "#fafbfc",
  border: "#e5e7eb",
  borderSoft: "#f3f4f6",
  positive: "#059669",
  positiveBg: "#ecfdf5",
  negative: "#E11D48",
  negativeBg: "#fef2f2",
  warning: "#D97706",
  warningBg: "#fffbeb",
  gold: "#FBBF24",
  bar1: "#FB7185",
  bar2: "#FBBF24",
  bar3: "#5391D5",
  bar4: "#34D399",
  bar5: "#FBBF24",
};

function scoreColor(n: number): string {
  return [, C.bar1, C.bar2, C.bar3, C.bar4, C.bar5][n] ?? C.bar3;
}

function recommendationColor(rec: string | null): string {
  if (rec === "ready_now") return C.positive;
  if (rec === "ready_with_development") return C.bar2;
  if (rec === "not_ready") return C.negative;
  return C.accent;
}

// ────────────────────────────────────────────────────────────────
// Section header helper (eyebrow + title + accent rule).
// ────────────────────────────────────────────────────────────────
function sectionHeader(eyebrow: string, title: string): string {
  return `
    <p class="section-eyebrow">${esc(eyebrow)}</p>
    <h2 class="section-title">${esc(title)}</h2>
    <div class="section-rule"></div>`;
}

function pageFooter(name: string): string {
  return `
    <div class="page-footer">
      <span class="footer-confidential">سري للغاية</span>
      <span class="footer-meta">${esc(name)} · مركز VIFM للتقييم®</span>
    </div>`;
}

// ────────────────────────────────────────────────────────────────
// Public entrypoint - produces a complete A4-portrait multi-page HTML
// document string. Pass into renderHtmlToPdfBuffer(html).
// ────────────────────────────────────────────────────────────────
export function renderCandidateReportHtmlAr(data: ReportData): string {
  const d = data;

  // ── Cover summary rows ──
  const coverRows: Array<[string, string]> = [
    ["المؤسسة", d.organizationName || "-"],
    ...(d.targetRole ? ([["الدور المستهدف", d.targetRole]] as Array<[string, string]>) : []),
    ["تواريخ التقييم", d.assessmentDates || "-"],
    ["المُقيّمون", d.assessorNames.join("، ") || "-"],
    ["تاريخ إصدار التقرير", d.generatedAt || "-"],
  ];
  const coverRowsHtml = coverRows
    .map(
      ([label, value]) => `
      <div class="cover-row">
        <span class="cover-label">${esc(label)}</span>
        <span class="cover-value">${esc(value)}</span>
      </div>`
    )
    .join("");

  // ── About page: exercises + BARS scale ──
  const exercisesHtml =
    d.exercisesUsed.length > 0
      ? `
      <h3 class="sub-section">التمارين المنجَزة</h3>
      ${d.exercisesUsed
        .map(
          (ex) =>
            `<p class="body-text bullet">• ${esc(ex.name)} (${esc(
              EXERCISE_LABELS_AR[ex.type] ?? ex.type
            )}${ex.durationMinutes ? ` · ${ex.durationMinutes} دقيقة` : ""})</p>`
        )
        .join("")}`
      : "";

  const barsScaleHtml = [5, 4, 3, 2, 1]
    .map((n) => `<p class="body-text bars-line">${n} - ${esc(BARS_AR[n])}</p>`)
    .join("");

  // ── Summary page stats ──
  const scoredComps = d.competencies.filter((c) => c.consensusScore != null);
  const strengthsCount = scoredComps.filter((c) => (c.consensusScore ?? 0) >= 4).length;
  const developmentCount = scoredComps.filter((c) => (c.consensusScore ?? 0) <= 2).length;

  const statTilesHtml = `
    <div class="stat-strip">
      ${statTile(
        "التقييم الإجمالي",
        d.overallScore ? `${d.overallScore}/5` : "-",
        d.overallScore ? BARS_AR[d.overallScore] ?? "" : "قيد الإعداد",
        d.overallScore ? scoreColor(d.overallScore) : C.textMuted
      )}
      ${statTile(
        "التوصية",
        d.recommendation ? OAR_LABELS_AR[d.recommendation] ?? "-" : "-",
        d.recommendation ? "وفق توافق المُقيّمين" : "بانتظار جلسة المراجعة",
        recommendationColor(d.recommendation)
      )}
      ${statTile("نقاط القوة", String(strengthsCount), `من ${scoredComps.length} مُقيّمة`, C.positive)}
      ${statTile(
        "مجالات التطوير",
        String(developmentCount),
        `من ${scoredComps.length} مُقيّمة`,
        C.negative
      )}
    </div>`;

  // Data-quality caveat (parity with the EN report) - flags a report built on
  // thin or single-rater evidence so a reader never mistakes it for complete.
  const showCaveatAr = d.hasAssessorData === false || (d.raterCount != null && d.raterCount < 2);
  const caveatHtml = showCaveatAr
    ? `<div style="margin-top:8px;padding:8px 10px;background:#FEF7E6;border-right:3px solid #D97706;border-radius:4px;font-size:9px;color:#92400E;line-height:1.6">${
        d.hasAssessorData === false
          ? "ملاحظة: أُعدّ هذا التقرير ببيانات ملاحظة محدودة، وقد لا تظهر أدلة مسجّلة لبعض الكفاءات. تُعامَل الدرجات كمؤشّر استرشادي."
          : "ملاحظة: تستند الدرجات إلى مُقيّم واحد، ما يقلّل من موثوقية الاتفاق بين المُقيّمين. تُعامَل الدرجات كمؤشّر استرشادي."
      }</div>`
    : "";
  const oarBoxHtml = (d.overallScore
    ? `
      <div class="oar-box">
        <div class="oar-row">
          <span class="oar-num">${d.overallScore}/5</span>
          <span class="oar-label">${esc(BARS_AR[d.overallScore] ?? "")}</span>
        </div>
        ${
          d.recommendation
            ? `<p class="oar-rec">التوصية · ${esc(OAR_LABELS_AR[d.recommendation] ?? d.recommendation)}</p>`
            : ""
        }
        ${d.executiveSummary ? `<p class="body-text oar-summary">${esc(d.executiveSummary)}</p>` : ""}
      </div>`
    : `
      <div class="oar-box">
        <p class="oar-pending">لم يُعتمَد التقييم الإجمالي بعد.</p>
      </div>`) + caveatHtml;

  const competencyBarsHtml = d.competencies
    .map((c) => {
      const sc = c.consensusScore;
      const fill = sc
        ? `<span class="bar-fill" style="width:${(sc / 5) * 100}%;background:${scoreColor(sc)}"></span>`
        : "";
      return `
        <div class="bar-row">
          <span class="bar-name">${esc(c.competencyName)}</span>
          <span class="bar-track">${fill}</span>
          <span class="bar-label">${sc ? `${sc}/5` : "قيد الإعداد"}</span>
          ${gapPillHtml(sc)}
        </div>`;
    })
    .join("");

  const strengthChipsHtml =
    d.topStrengths.length > 0
      ? `
      <h3 class="sub-section" style="color:${C.positive}">أبرز نقاط القوة</h3>
      <div class="chip-row">
        ${d.topStrengths
          .map(
            (n) =>
              `<span class="summary-chip" style="background:${C.positiveBg};border-color:${C.positive};color:${C.positive}">${esc(n)}</span>`
          )
          .join("")}
      </div>`
      : "";

  const devChipsHtml =
    d.topDevelopmentAreas.length > 0
      ? `
      <h3 class="sub-section" style="color:${C.warning}">أبرز مجالات التطوير</h3>
      <div class="chip-row">
        ${d.topDevelopmentAreas
          .map(
            (n) =>
              `<span class="summary-chip" style="background:${C.warningBg};border-color:${C.warning};color:${C.warning}">${esc(n)}</span>`
          )
          .join("")}
      </div>`
      : "";

  const techCertChipsHtml =
    (d.technicalCertifications?.length ?? 0) > 0
      ? `
      <h3 class="sub-section" style="color:#4338ca">الاعتمادات التقنية</h3>
      <div class="chip-row">
        ${d
          .technicalCertifications!.map(
            (c) =>
              `<span class="summary-chip" style="background:#eef2ff;border-color:#6366f1;color:#3730a3">${esc(
                c.domainNameAr ?? c.domainNameEn
              )}${c.level != null ? ` · المستوى ${c.level}/5` : ""}</span>`
          )
          .join("")}
      </div>`
      : "";

  // ── Competency detail cards ──
  const competencyCardsHtml = d.competencies
    .map((c) => {
      const sc = c.consensusScore ?? 0;
      const accent = c.consensusScore ? scoreColor(c.consensusScore) : C.textMuted;

      const badgeHtml = c.consensusScore
        ? `<span class="comp-badge" style="background:${scoreColor(c.consensusScore)}">${sc}/5 · ${esc(BARS_AR[sc] ?? "")}</span>`
        : `<span class="comp-badge comp-badge-pending">قيد الإعداد</span>`;

      const exerciseRatingsHtml =
        c.exerciseRatings.length > 0
          ? `
          <p class="find-group-title muted">تقييمات التمارين</p>
          ${c.exerciseRatings
            .map(
              (er) => `
            <div class="ex-rat-row">
              <span class="ex-rat-name">${esc(er.exerciseName)}</span>
              <span class="ex-rat-score" style="color:${scoreColor(er.score)}">${er.score}/5 · ${esc(BARS_AR[er.score] ?? "")}</span>
            </div>`
            )
            .join("")}`
          : "";

      const strengthsHtml =
        c.strengths.length > 0
          ? findingGroup(
              "strength",
              "نقاط القوة المرصودة",
              c.strengths
                .map(
                  (ev) => `
              <div class="find-item">
                <span class="find-glyph" style="color:${C.positive}">+</span>
                <span class="find-text"><span class="find-exercise">[${esc(ev.exerciseName)}]</span> ${esc(ev.text)}</span>
              </div>`
                )
                .join("")
            )
          : "";

      const devAreasHtml =
        c.developmentAreas.length > 0
          ? findingGroup(
              "development",
              "مجالات التطوير",
              c.developmentAreas
                .map(
                  (ev) => `
              <div class="find-item">
                <span class="find-glyph" style="color:${C.negative}">−</span>
                <span class="find-text"><span class="find-exercise">[${esc(ev.exerciseName)}]</span> ${esc(ev.text)}</span>
              </div>`
                )
                .join("")
            )
          : "";

      const devTipsHtml =
        c.developmentTips.length > 0
          ? findingGroup(
              "action",
              "إجراءات التطوير المقترحة",
              c.developmentTips.map((tip) => `<p class="dev-tip">· ${esc(tip)}</p>`).join("")
            )
          : "";

      // Mirror the EN card's "DOMAIN · Cluster · WEIGHT n" meta line.
      // toUpperCase() is a no-op for Arabic script but normalises any
      // Latin-script domain names that still come through the data.
      const clusterLine = [
        c.domainName ? esc(c.domainName.toUpperCase()) : null,
        c.clusterName ? esc(c.clusterName) : null,
        c.weight ? `الوزن ${c.weight}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return `
        <article class="comp-card" style="border-inline-start-color:${accent}">
          <div class="comp-head">
            <div class="comp-head-titles">
              <h3 class="comp-name">${esc(c.competencyName)}</h3>
              <p class="comp-cluster">${clusterLine}</p>
            </div>
            <div class="comp-head-badges">
              ${gapPillHtml(c.consensusScore)}
              ${badgeHtml}
            </div>
          </div>
          <div class="comp-body">
            ${exerciseRatingsHtml}
            ${strengthsHtml}
            ${devAreasHtml}
            ${devTipsHtml}
          </div>
        </article>`;
    })
    .join("");

  // ── Development recommendations table ──
  const devRecsHtml =
    d.developmentRecommendations.length === 0
      ? `<p class="body-text">لم تُسجَّل توصيات تطوير رسمية لهذا المرشّح. يُرجى الرجوع إلى إجراءات التطوير المقترحة ضمن كل قسم من أقسام الكفاءات أعلاه.</p>`
      : `
        <div class="rec-table">
          <div class="rec-head-row">
            <span class="rec-col-comp">الكفاءة</span>
            <span class="rec-col-text">التوصية</span>
            <span class="rec-col-priority">الأولوية</span>
          </div>
          ${d.developmentRecommendations
            .map(
              (rec) => `
            <div class="rec-row">
              <span class="rec-col-comp rec-comp-name">${esc(rec.competencyName)}</span>
              <span class="rec-col-text">${esc(rec.recommendation)}</span>
              <span class="rec-col-priority">${esc(rec.priority)}</span>
            </div>`
            )
            .join("")}
        </div>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير التقييم · ${esc(d.candidateName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${AR_FONT_HREF}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Noto Naskh Arabic", "Segoe UI", Tahoma, serif;
      direction: rtl;
      color: ${C.text};
      font-size: 11pt;
      line-height: 1.6;
      background: #fff;
    }
    @page { size: A4; margin: 0; }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 16mm;
      page-break-after: always;
      position: relative;
    }
    .page:last-child { page-break-after: auto; }

    .muted { color: ${C.textLight}; }

    /* ─── Cover ─── */
    .cover {
      background: ${C.primary};
      color: #fff;
      padding: 0;
    }
    .cover-banner { padding: 34mm 22mm 16mm 22mm; }
    .cover-gold-rule { width: 36px; height: 2px; background: ${C.gold}; margin-bottom: 18px; }
    .cover-confidential {
      font-size: 8pt;
      color: #fff;
      opacity: 0.65;
      letter-spacing: 0.18em;
      margin-bottom: 24px;
    }
    .cover-eyebrow {
      font-size: 9pt;
      color: ${C.accent};
      letter-spacing: 0.14em;
      font-weight: 700;
      margin: 0 0 6px;
    }
    .cover-title { font-size: 30pt; color: #fff; font-weight: 700; margin: 0 0 6px; }
    .cover-subtitle { font-size: 12pt; color: #fff; opacity: 0.78; margin: 0; }
    .cover-name-pill {
      display: inline-block;
      margin-top: 30px;
      padding: 6px 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
    }
    .cover-name-pill-text { font-size: 11pt; color: #fff; font-weight: 700; }
    .cover-details {
      padding: 24px 22mm;
      background: rgba(255,255,255,0.04);
      border-top: 1px solid rgba(255,255,255,0.10);
    }
    .cover-details-heading {
      font-size: 8pt;
      color: #fff;
      opacity: 0.5;
      letter-spacing: 0.18em;
      font-weight: 700;
      margin: 0 0 12px;
    }
    .cover-row { display: flex; margin-bottom: 7px; }
    .cover-label { width: 150px; font-size: 9pt; color: #fff; opacity: 0.55; }
    .cover-value { font-size: 9.5pt; color: #fff; font-weight: 700; }
    .cover-footer {
      position: absolute;
      bottom: 18mm;
      left: 22mm;
      right: 22mm;
    }
    .cover-footer-text {
      font-size: 7.5pt;
      color: #fff;
      opacity: 0.45;
      text-align: center;
      letter-spacing: 0.05em;
    }

    /* ─── Section header ─── */
    .section-eyebrow {
      font-size: 8pt;
      color: ${C.textLight};
      letter-spacing: 0.14em;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .section-title { font-size: 18pt; font-weight: 700; color: ${C.primary}; margin: 0 0 8px; }
    .section-rule { width: 24px; height: 1.5px; background: ${C.accent}; margin-bottom: 14px; }

    .sub-section { font-size: 11pt; font-weight: 700; color: ${C.primary}; margin: 16px 0 6px; }
    .body-text { font-size: 9.5pt; line-height: 1.65; color: ${C.text}; margin: 0 0 8px; }
    .body-text.bullet { margin-bottom: 3px; }
    .body-text.bars-line { padding-inline-start: 12px; margin-bottom: 2px; }

    /* ─── Stat tiles ─── */
    .stat-strip { display: flex; gap: 8px; margin-bottom: 18px; }
    .stat-tile {
      flex: 1;
      padding: 10px;
      background: ${C.bgSoft};
      border: 0.5px solid ${C.border};
      border-top: 2px solid ${C.accent};
      border-radius: 4px;
    }
    .stat-label {
      font-size: 7.5pt;
      color: ${C.textLight};
      letter-spacing: 0.1em;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .stat-value { font-size: 20pt; font-weight: 700; color: ${C.primary}; line-height: 1; }
    .stat-suffix { font-size: 8.5pt; color: ${C.textLight}; margin: 4px 0 0; }

    /* ─── OAR box ─── */
    .oar-box {
      background: ${C.bgSoft};
      border: 0.5px solid ${C.border};
      border-inline-start: 3px solid ${C.accent};
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 18px;
    }
    .oar-row { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
    .oar-num { font-size: 32pt; font-weight: 700; color: ${C.primary}; }
    .oar-label { font-size: 12pt; color: ${C.textLight}; }
    .oar-rec {
      font-size: 11pt;
      font-weight: 700;
      color: ${C.accent};
      margin: 0 0 8px;
      letter-spacing: 0.03em;
    }
    .oar-summary { margin-top: 4px; }
    .oar-pending { font-size: 10pt; color: ${C.textLight}; margin: 0; }

    /* ─── Competency bars ─── */
    .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .bar-name { font-size: 9pt; width: 150px; color: ${C.text}; }
    .bar-track {
      flex: 1;
      height: 6px;
      background: ${C.borderSoft};
      border-radius: 3px;
      overflow: hidden;
      display: block;
    }
    .bar-fill { height: 6px; border-radius: 3px; display: block; }
    .bar-label { font-size: 8pt; color: ${C.textLight}; width: 48px; text-align: start; }
    .gap-pill {
      font-size: 7pt;
      font-weight: 700;
      padding: 1.5px 6px;
      border-radius: 8px;
      border: 0.5px solid;
      white-space: nowrap;
    }

    /* ─── Summary chips ─── */
    .chip-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 4px; }
    .summary-chip {
      font-size: 8pt;
      font-weight: 700;
      padding: 4px 9px;
      border-radius: 12px;
      border: 0.5px solid;
    }

    /* ─── Competency cards ─── */
    .comp-card {
      margin-bottom: 12px;
      border: 0.5px solid ${C.border};
      border-inline-start: 3px solid ${C.accent};
      border-radius: 4px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .comp-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      background: ${C.bgSoft};
      padding: 8px 12px;
      border-bottom: 0.5px solid ${C.border};
    }
    .comp-head-titles { flex: 1; }
    .comp-name { font-size: 11pt; font-weight: 700; color: ${C.primary}; margin: 0; }
    .comp-cluster { font-size: 7pt; color: ${C.textLight}; margin: 2px 0 0; letter-spacing: 0.03em; }
    .comp-head-badges { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .comp-badge {
      font-size: 9pt;
      font-weight: 700;
      color: #fff;
      padding: 3px 9px;
      border-radius: 10px;
      white-space: nowrap;
    }
    .comp-badge-pending { background: ${C.borderSoft}; color: ${C.textLight}; }
    .comp-body { padding: 12px; }

    /* ─── Finding groups ─── */
    .find-group {
      margin-top: 8px;
      padding: 9px;
      border-radius: 3px;
      border-inline-start: 2px solid;
    }
    .find-group-title {
      font-size: 7.5pt;
      letter-spacing: 0.1em;
      font-weight: 700;
      margin: 0 0 5px;
    }
    .find-group-title.muted { color: ${C.textLight}; margin-bottom: 4px; }
    .find-item { display: flex; gap: 4px; margin-bottom: 4px; }
    .find-glyph { width: 12px; font-size: 9pt; font-weight: 700; flex-shrink: 0; }
    .find-exercise { font-size: 8pt; font-weight: 700; color: ${C.accent}; margin-inline-end: 4px; }
    .find-text { flex: 1; font-size: 8.5pt; line-height: 1.5; color: ${C.text}; }

    .ex-rat-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      border-bottom: 0.5px solid ${C.borderSoft};
    }
    .ex-rat-name { font-size: 8.5pt; color: ${C.text}; }
    .ex-rat-score { font-size: 8.5pt; font-weight: 700; }

    .dev-tip { font-size: 8.5pt; line-height: 1.5; color: ${C.text}; margin: 0 0 3px; padding-inline-start: 10px; }

    /* ─── Recommendations table ─── */
    .rec-table { width: 100%; }
    .rec-head-row {
      display: flex;
      padding: 5px 0;
      border-bottom: 1px solid ${C.primary};
      margin-bottom: 4px;
    }
    .rec-row {
      display: flex;
      padding: 5px 0;
      border-bottom: 0.5px solid ${C.border};
    }
    .rec-col-comp { width: 150px; font-size: 9pt; flex-shrink: 0; }
    .rec-head-row .rec-col-comp,
    .rec-head-row .rec-col-text,
    .rec-head-row .rec-col-priority {
      font-size: 8pt;
      font-weight: 700;
      color: ${C.textLight};
    }
    .rec-comp-name { font-weight: 700; }
    .rec-col-text { flex: 1; font-size: 9pt; line-height: 1.45; }
    .rec-col-priority { width: 60px; font-size: 8pt; color: ${C.textLight}; text-align: start; flex-shrink: 0; }

    /* ─── Page footer ─── */
    .page-footer {
      position: absolute;
      bottom: 10mm;
      left: 16mm;
      right: 16mm;
      display: flex;
      justify-content: space-between;
      border-top: 0.5px solid ${C.borderSoft};
      padding-top: 6px;
    }
    .footer-confidential { font-size: 7pt; color: ${C.negative}; font-weight: 700; letter-spacing: 0.05em; }
    .footer-meta { font-size: 7pt; color: ${C.textLight}; letter-spacing: 0.05em; }
  </style>
</head>
<body>

  <!-- PAGE 1 - Cover -->
  <section class="page cover">
    <div class="cover-banner">
      <div class="cover-gold-rule"></div>
      <p class="cover-confidential">سري · للاستخدام الداخلي في VIFM</p>
      <p class="cover-eyebrow">مركز VIFM للتقييم®</p>
      <h1 class="cover-title">تقرير تقييم المواهب</h1>
      <p class="cover-subtitle">${esc(d.engagementName)}${d.targetRole ? ` · ${esc(d.targetRole)}` : ""}</p>
      <span class="cover-name-pill"><span class="cover-name-pill-text">${esc(d.candidateName)}</span></span>
    </div>
    <div class="cover-details">
      <p class="cover-details-heading">ملخّص التقييم</p>
      ${coverRowsHtml}
    </div>
    <div class="cover-footer">
      <p class="cover-footer-text">معهد فرجينيا للتمويل والإدارة · تقرير تقييم سري</p>
    </div>
  </section>

  <!-- PAGE 2 - About the Assessment Centre -->
  <section class="page">
    ${sectionHeader("المنهجية", "نبذة عن مركز التقييم")}
    <p class="body-text">شارك ${esc(d.candidateName)} في مركز VIFM لتقييم المواهب ضمن مشروع ${esc(d.engagementName)}. يلخّص هذا التقرير نتائج التقييم.</p>
    <p class="body-text">تتألّف مراكز التقييم من عدد من الأنشطة والتمارين المختلفة التي تتيح للمشاركين فرصاً متنوّعة لإظهار كفاءاتهم. يراقب المشاركين مُقيّمون مدرَّبون يجمعون أدلّة سلوكية مرتبطة بالكفاءات ذات الصلة.</p>
    ${exercisesHtml}
    <h3 class="sub-section">كيفية استخدام هذا التقرير</h3>
    <p class="body-text">في كل كفاءة، جرى تقييم ${esc(d.candidateName)} على مقياس من 1 إلى 5:</p>
    ${barsScaleHtml}
    <p class="body-text" style="margin-top:6px">لا يمثّل التقييم الإجمالي للكفاءة بالضرورة متوسط درجات التمارين - إذ تُرجَّح بعض الأنشطة أكثر من غيرها استناداً إلى مصفوفة الكفاءات والتمارين.</p>
    <p class="body-text">يقدّم هذا التقرير معلومات حول نقاط قوة المشارك ومجالات تطوّره فيما يتعلق بالمهارات والسلوكيات المهمّة للدور المستهدف. يمكن اعتبار هذا التقرير وثيق الصلة بصورة خاصة خلال الأشهر الأربعة والعشرين القادمة.</p>
    ${pageFooter(d.candidateName)}
  </section>

  <!-- PAGE 3 - Summary -->
  <section class="page">
    ${sectionHeader("نظرة تنفيذية", "ملخّص الأداء")}
    ${statTilesHtml}
    ${oarBoxHtml}
    <h3 class="sub-section">تقييمات الكفاءات</h3>
    ${competencyBarsHtml}
    ${strengthChipsHtml}
    ${devChipsHtml}
    ${techCertChipsHtml}
    ${pageFooter(d.candidateName)}
  </section>

  <!-- PAGE 4 - Competency Detail (flows across pages) -->
  <section class="page">
    ${sectionHeader("نتائج كل كفاءة", "تفصيل الكفاءات")}
    ${competencyCardsHtml}
    ${pageFooter(d.candidateName)}
  </section>

  <!-- PAGE 5 - Development Recommendations -->
  <section class="page">
    ${sectionHeader("خطة العمل", "توصيات التطوير")}
    ${devRecsHtml}
    ${pageFooter(d.candidateName)}
  </section>

</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────
// Small render helpers kept at module scope so the main function reads
// as a top-to-bottom page sequence.
// ────────────────────────────────────────────────────────────────

function statTile(label: string, value: string, suffix: string, accent: string): string {
  return `
    <div class="stat-tile" style="border-top-color:${accent}">
      <p class="stat-label">${esc(label)}</p>
      <p class="stat-value">${esc(value)}</p>
      <p class="stat-suffix">${esc(suffix)}</p>
    </div>`;
}

function findingGroup(
  variant: "strength" | "development" | "action",
  title: string,
  inner: string
): string {
  const tone = {
    strength: { bg: C.positiveBg, bd: C.positive, fg: C.positive },
    development: { bg: C.negativeBg, bd: C.negative, fg: C.negative },
    action: { bg: C.warningBg, bd: C.warning, fg: C.warning },
  }[variant];
  return `
    <div class="find-group" style="background:${tone.bg};border-inline-start-color:${tone.bd}">
      <p class="find-group-title" style="color:${tone.fg}">${esc(title)}</p>
      ${inner}
    </div>`;
}
