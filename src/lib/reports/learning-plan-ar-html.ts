/**
 * Arabic / RTL HTML renderer for the candidate Learning Plan PDF.
 *
 * Pairs with React-PDF for English in the same route:
 *
 *   ar  → renderLearningPlanHtmlAr → Puppeteer page.setContent → PDF
 *   en  → existing React-PDF LearningPlan component (unchanged)
 *
 * React-PDF cannot shape Arabic glyphs (no harfbuzz / no font fallback),
 * which is why the EN path stays on it and the AR path goes through a
 * Chromium render - Chrome's text engine has full bidi + Arabic shaping
 * out of the box, so all we need is well-formed RTL HTML with a real
 * Arabic font loaded.
 *
 * Layout intentionally mirrors the React-PDF EN four-page layout so the
 * two versions feel like the same report:
 *
 *   Page 1 - Cover (navy banner, title, candidate pill, "what's inside")
 *   Page 2 - 30 / 60 / 90 day roadmap (three phase cards)
 *   Page 3 - Per-competency action cards (gap pill, tips, recommendation)
 *            + coaching-conversation reflection prompts
 *   Page 4 - Recommended VIFM programmes (course cards, fit pills, drivers)
 *            Omitted when there are no recommended courses.
 *
 * All Arabic copy lives in this file so a translator can update it in one
 * place without touching the React-PDF EN code.
 *
 * ⚠️  STILL NEEDS NATIVE REVIEW before public-facing distribution. The
 * CLAUDE.md "Important Notes" section flags that Arabic translations are
 * placeholders - that warning extends to this file too.
 */

import type { ReportData, ReportCompetencyData } from "./report-types";
import { getCompetencyGap, GAP_TONES } from "@/lib/scoring/competency-gap";
import { formatFitScore, fitMatchPercent } from "@/lib/recommender/format";
import { AR_FONT_HREF, escapeHtml } from "./html-to-pdf";

// ────────────────────────────────────────────────────────────────
// VIFM brand palette + phase tones (mirrors learning-plan.tsx `C`).
// ────────────────────────────────────────────────────────────────
const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
  borderSoft: "#f3f4f6",
  bgSoft: "#fafbfc",
  gold: "#FBBF24",
  negative: "#E11D48",
  phase30: "#E11D48", // rose - immediate
  phase60: "#D97706", // amber - near-term
  phase90: "#059669", // emerald - sustained
};

// ────────────────────────────────────────────────────────────────
// Phase metadata (the EN PHASE_LABELS, in Arabic).
// ────────────────────────────────────────────────────────────────
const PHASE_META: Record<
  "high" | "medium" | "low",
  { window: string; heading: string; subtitle: string; color: string }
> = {
  high: {
    window: "أول 30 يوماً",
    heading: "الآن",
    subtitle: "فجوات بالغة الأهمية. ابدأ فوراً.",
    color: C.phase30,
  },
  medium: {
    window: "اليوم 30 - 60",
    heading: "التالي",
    subtitle: "ابنِ الزخم على التطوير الأوسع.",
    color: C.phase60,
  },
  low: {
    window: "اليوم 60 - 90",
    heading: "لاحقاً",
    subtitle: "استدِم النموّ - واستكمل ملامح ملفّك.",
    color: C.phase90,
  },
};

// ────────────────────────────────────────────────────────────────
// Phase card - one of the three columns of the 30/60/90 roadmap.
// ────────────────────────────────────────────────────────────────
function phaseCardHtml(
  phase: "high" | "medium" | "low",
  recs: ReportData["developmentRecommendations"]
): string {
  const meta = PHASE_META[phase];
  const body =
    recs.length === 0
      ? `<p class="phase-empty">لا توجد بنود بهذه الأولوية.</p>`
      : recs
          .map((r) => {
            const rec =
              r.recommendation.length > 130
                ? r.recommendation.slice(0, 130) + "…"
                : r.recommendation;
            return `
              <div class="phase-item-wrap">
                <p class="phase-item phase-item-name">· ${escapeHtml(r.competencyName)}</p>
                <p class="phase-item phase-item-rec">${escapeHtml(rec)}</p>
              </div>`;
          })
          .join("");
  return `
    <div class="phase-card" style="border-top-color:${meta.color}">
      <p class="phase-window" style="color:${meta.color}">${escapeHtml(meta.window)}</p>
      <p class="phase-heading">${escapeHtml(meta.heading)}</p>
      <p class="phase-subtitle">${escapeHtml(meta.subtitle)}</p>
      ${body}
    </div>`;
}

// ────────────────────────────────────────────────────────────────
// Gap pill - mirrors the React-PDF <GapPill>. Reuses the same
// gap-severity computation + tone palette so EN and AR show the
// same colours for the same gap. The label text itself comes from
// getCompetencyGap (English); the surrounding chrome is Arabic.
// ────────────────────────────────────────────────────────────────
function gapPillHtml(score: number | null, target?: number): string {
  const data = getCompetencyGap(score, target);
  if (!data) return "";
  const tone = GAP_TONES[data.severity];
  return `<span class="gap-pill" style="background:${tone.bg};border-color:${tone.border};color:${tone.fg}">${escapeHtml(
    data.label
  )}</span>`;
}

// ────────────────────────────────────────────────────────────────
// Per-competency action card - mirrors the React-PDF compCard.
// Uses the provided English competency name (the report data shape
// does not carry an Arabic competency name); domain + cluster shown
// as supplied.
// ────────────────────────────────────────────────────────────────
function competencyCardHtml(
  c: ReportCompetencyData,
  recByName: Map<string, { recommendation: string }>
): string {
  const rec = recByName.get(c.competencyName.toLowerCase());
  const tips =
    c.developmentTips.length > 0
      ? `
        <p class="group-title">إجراءات محدّدة للتدرّب عليها</p>
        ${c.developmentTips
          .slice(0, 5)
          .map(
            (tip) =>
              `<div class="tip-item"><span class="tip-bullet">·</span><span class="tip-text">${escapeHtml(
                tip
              )}</span></div>`
          )
          .join("")}`
      : "";
  const recBox = rec
    ? `
      <div class="rec-box">
        <p class="group-title">التركيز الموصى به</p>
        <p class="tip-text rec-text">${escapeHtml(rec.recommendation)}</p>
      </div>`
    : "";
  return `
    <article class="comp-card">
      <div class="comp-head">
        <div>
          <p class="comp-name">${escapeHtml(c.competencyName)}</p>
          <p class="comp-cluster">${escapeHtml(c.domainName.toUpperCase())} · ${escapeHtml(c.clusterName)}</p>
        </div>
        ${gapPillHtml(c.consensusScore)}
      </div>
      <div class="comp-body">
        ${tips}
        ${recBox}
      </div>
    </article>`;
}

// ────────────────────────────────────────────────────────────────
// Course card - mirrors the React-PDF CoursesPage card. Prefers the
// Arabic course title where present, else the English title.
// ────────────────────────────────────────────────────────────────
function courseCardHtml(c: NonNullable<ReportData["recommendedCourses"]>[number], topScore: number): string {
  const isHighFit = c.total_score >= 4;
  const pct = fitMatchPercent(c.total_score, topScore);
  const titleAr = c.title_ar ?? c.title_en;
  const level = c.level.charAt(0).toUpperCase() + c.level.slice(1);
  const drivers = c.drivers
    .map(
      (d) =>
        `<span class="driver-chip">${escapeHtml(d.label)} · الفجوة ${escapeHtml(
          formatFitScore(d.gap)
        )} × ×${d.relevance}</span>`
    )
    .join("");
  const fit = isHighFit
    ? `<span class="course-fit">★ ملاءمة عالية · ${pct}% مطابقة</span>`
    : "";
  return `
    <article class="course-card">
      <header class="course-head">
        <div class="course-title-wrap">
          <span class="course-title">${escapeHtml(titleAr)}</span>
          ${c.code ? `<span class="course-code">${escapeHtml(c.code)}</span>` : ""}
        </div>
        ${fit}
      </header>
      <div class="course-meta">
        <span class="meta-pill">${escapeHtml(c.vertical)}</span>
        <span class="meta-pill">${escapeHtml(level)}</span>
        <span class="meta-pill">${escapeHtml(c.duration_label)}</span>
        ${
          !isHighFit
            ? `<span class="meta-pill">${pct}% مطابقة</span>`
            : ""
        }
      </div>
      <p class="group-title course-why">لماذا هذه الدورة</p>
      <div class="course-drivers">${drivers}</div>
      ${
        c.drivers[0]?.rationale
          ? `<p class="course-rationale">${escapeHtml(c.drivers[0].rationale)}</p>`
          : ""
      }
    </article>`;
}

// ────────────────────────────────────────────────────────────────
// Public entrypoint - produces a complete A4-portrait HTML document
// string. Pass into renderHtmlToPdfBuffer (Puppeteer).
// ────────────────────────────────────────────────────────────────
export function renderLearningPlanHtmlAr(data: ReportData): string {
  const recs = data.developmentRecommendations ?? [];
  const high = recs.filter((r) => r.priority === "high");
  const medium = recs.filter((r) => r.priority === "medium");
  const low = recs.filter(
    (r) => r.priority === "low" || (r.priority !== "high" && r.priority !== "medium")
  );

  // Competencies that fell below target (score < 4) - the focus set.
  const focus = data.competencies.filter(
    (c) => c.consensusScore != null && c.consensusScore < 4
  );
  const recByName = new Map(
    recs.map((r) => [r.competencyName.toLowerCase(), { recommendation: r.recommendation }])
  );

  const courses = data.recommendedCourses ?? [];

  // ── Page 2 body
  const roadmapEmpty =
    recs.length === 0
      ? `
        <div class="closing-box">
          <h3 class="closing-heading">لا توجد توصيات بعد</h3>
          <p class="body-text" style="margin-bottom:0">ما زال فريق المقيّمين يضع اللمسات الأخيرة على خطة التطوير. تبقى نصائح كل كفاءة في الصفحات التالية سارية - ابدأ منها.</p>
        </div>`
      : "";

  // ── Page 3 body
  const competencyCards =
    focus.length === 0
      ? `<p class="body-text">لم تقع أيّ كفاءة دون المستوى المستهدف. استخدم صفحة خارطة الطريق لترسيخ نقاط قوّتك وتوسيع نطاقك.</p>`
      : focus.map((c) => competencyCardHtml(c, recByName)).join("");

  // ── Page 4 (omitted when no courses)
  const coursesPage =
    courses.length > 0
      ? `
  <section class="page">
    <p class="section-eyebrow">تدريب مستهدف</p>
    <h2 class="section-title">البرامج التدريبية الموصى بها من VIFM</h2>
    <div class="section-rule"></div>
    <p class="body-text">ترتبط دورات VIFM التدريبية هذه بالكفاءات التي جاءت درجاتك فيها دون المستوى المستهدف. وهي مرتّبة حسب مدى مطابقتها لفجواتك - يظهر أقوى تطابق بنسبة 100% وتُعرض البقية نسبةً إليه. ناقش مع مديرك أو مع استشاري VIFM أيّ دورة تناسب أولويتك التطويرية الحالية.</p>
    ${courses.map((c) => courseCardHtml(c, Math.max(0, ...courses.map((x) => x.total_score)))).join("")}
    ${footerHtml(data.candidateName)}
  </section>`
      : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>خطة التعلّم · ${escapeHtml(data.candidateName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${AR_FONT_HREF}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, serif;
      direction: rtl;
      color: ${C.text};
      font-size: 11pt;
      line-height: 1.55;
      background: #fff;
    }
    @page { size: A4; margin: 0; }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 16mm 22mm 16mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }

    /* Cover */
    .cover {
      width: 210mm;
      min-height: 297mm;
      background: ${C.primary};
      color: #fff;
      padding: 0;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .cover-banner { padding: 90px 60px 50px 60px; }
    .cover-gold-rule { width: 36px; height: 2px; background: ${C.gold}; margin-bottom: 20px; }
    .cover-eyebrow {
      font-size: 9pt;
      color: ${C.accent};
      letter-spacing: 0.22em;
      margin: 0 0 6px;
      font-weight: 700;
    }
    .cover-title { font-size: 30pt; color: #fff; font-weight: 700; margin: 0 0 6px; line-height: 1.15; }
    .cover-subtitle { font-size: 12pt; color: #fff; opacity: 0.78; margin: 0; }
    .cover-name-pill {
      display: inline-block;
      margin-top: 36px;
      padding: 6px 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
    }
    .cover-name-pill span { font-size: 11pt; color: #fff; font-weight: 700; letter-spacing: 0.03em; }
    .cover-inside-box {
      margin-top: 38px;
      padding: 18px;
      background: rgba(255,255,255,0.06);
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.10);
    }
    .cover-inside-heading {
      font-size: 8pt;
      color: #fff;
      opacity: 0.55;
      letter-spacing: 0.22em;
      font-weight: 700;
      margin: 0 0 10px;
    }
    .cover-inside-item { font-size: 10pt; color: #fff; opacity: 0.85; margin: 0 0 5px; }
    .cover-footer {
      position: absolute;
      bottom: 30px;
      left: 60px;
      right: 60px;
      padding-top: 10px;
    }
    .cover-footer p {
      font-size: 7pt;
      color: #fff;
      opacity: 0.45;
      text-align: center;
      letter-spacing: 0.05em;
      margin: 0;
    }

    /* Section headers */
    .section-eyebrow {
      font-size: 8pt;
      color: ${C.textLight};
      letter-spacing: 0.16em;
      font-weight: 700;
      text-transform: uppercase;
      margin: 0 0 4px;
    }
    .section-title { font-size: 18pt; font-weight: 700; color: ${C.primary}; margin: 0 0 8px; }
    .section-rule { width: 24px; height: 1.5px; background: ${C.accent}; margin-bottom: 14px; }
    .body-text { font-size: 9.5pt; line-height: 1.6; color: ${C.text}; margin: 0 0 10px; }

    /* Timeline (30/60/90) */
    .timeline-row { display: flex; gap: 8px; margin: 4px 0 12px; }
    .phase-card {
      flex: 1;
      border: 0.5pt solid ${C.border};
      border-top: 3px solid ${C.border};
      border-radius: 4px;
      background: ${C.bgSoft};
      padding: 12px;
    }
    .phase-window { font-size: 7.5pt; letter-spacing: 0.14em; font-weight: 700; text-transform: uppercase; margin: 0 0 4px; }
    .phase-heading { font-size: 14pt; font-weight: 700; color: ${C.primary}; margin: 0 0 3px; }
    .phase-subtitle { font-size: 8pt; color: ${C.textLight}; margin: 0 0 8px; }
    .phase-item-wrap { margin-bottom: 6px; }
    .phase-item { font-size: 8.5pt; color: ${C.text}; line-height: 1.45; margin: 0 0 2px; }
    .phase-item-name { font-weight: 700; }
    .phase-item-rec { padding-inline-start: 8px; }
    .phase-empty { font-size: 8.5pt; color: ${C.textMuted}; font-style: italic; margin: 0; }

    /* Competency cards */
    .comp-card {
      border: 0.5pt solid ${C.border};
      border-inline-start: 3px solid ${C.border};
      border-radius: 4px;
      margin-bottom: 12px;
      break-inside: avoid;
    }
    .comp-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      background: ${C.bgSoft};
      padding: 8px 12px;
      border-bottom: 0.5pt solid ${C.border};
    }
    .comp-name { font-size: 11pt; font-weight: 700; color: ${C.primary}; margin: 0; }
    .comp-cluster { font-size: 7pt; color: ${C.textLight}; margin: 2px 0 0; letter-spacing: 0.04em; }
    .comp-body { padding: 12px; }
    .gap-pill {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 8px;
      border: 0.5pt solid transparent;
      white-space: nowrap;
    }
    .group-title {
      font-size: 7.5pt;
      letter-spacing: 0.14em;
      font-weight: 700;
      text-transform: uppercase;
      color: ${C.textLight};
      margin: 0 0 5px;
    }
    .tip-item { display: flex; gap: 6px; margin-bottom: 4px; }
    .tip-bullet { color: ${C.accent}; font-weight: 700; font-size: 9pt; }
    .tip-text { flex: 1; font-size: 8.5pt; line-height: 1.45; color: ${C.text}; }
    .rec-box {
      margin-top: 8px;
      padding: 9px;
      border-radius: 3px;
      border-inline-start: 2px solid ${C.accent};
      background: #eff6ff;
    }
    .rec-text { font-size: 9pt; }

    /* Closing / reflection box */
    .closing-box {
      margin-top: 16px;
      padding: 14px;
      border-radius: 4px;
      background: ${C.bgSoft};
      border-inline-start: 3px solid ${C.accent};
    }
    .closing-heading { font-size: 11pt; font-weight: 700; color: ${C.primary}; margin: 0 0 6px; }

    /* Course cards */
    .course-card {
      border: 0.5pt solid ${C.border};
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 10px;
      background: ${C.bgSoft};
      break-inside: avoid;
    }
    .course-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .course-title-wrap { flex: 1; }
    .course-title { font-size: 11pt; font-weight: 700; color: ${C.primary}; }
    .course-code { font-size: 8pt; color: ${C.textLight}; margin-inline-start: 6px; font-family: Consolas, monospace; }
    .course-fit {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 8px;
      background: #fef3c7;
      color: #92400e;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .course-meta { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 6px; }
    .meta-pill {
      font-size: 7pt;
      padding: 2px 6px;
      border-radius: 8px;
      border: 0.5pt solid ${C.border};
      background: #fff;
      color: ${C.text};
    }
    .course-why { margin-top: 4px; }
    .course-drivers { display: flex; flex-wrap: wrap; gap: 4px; }
    .driver-chip {
      font-size: 7.5pt;
      padding: 2px 6px;
      border-radius: 8px;
      border: 0.5pt solid #bfdbfe;
      background: #eff6ff;
      color: #1e40af;
    }
    .course-rationale { font-size: 8pt; color: ${C.textLight}; margin: 4px 0 0; line-height: 1.45; }

    /* Footer at the bottom of each content page */
    .page-footer {
      position: absolute;
      bottom: 10mm;
      left: 16mm;
      right: 16mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 0.5pt solid ${C.borderSoft};
      padding-top: 6px;
    }
    .page-footer .confidential { font-size: 7pt; color: ${C.negative}; font-weight: 700; letter-spacing: 0.05em; }
    .page-footer .footer-text { font-size: 7pt; color: ${C.textLight}; letter-spacing: 0.04em; }
  </style>
</head>
<body>

  <!-- PAGE 1 - Cover -->
  <section class="cover">
    <div class="cover-banner">
      <div class="cover-gold-rule"></div>
      <p class="cover-eyebrow">مركز تقييم VIFM</p>
      <h1 class="cover-title">خطة التعلّم الشخصية</h1>
      <p class="cover-subtitle">${escapeHtml(data.engagementName)}${
    data.targetRole ? ` · ${escapeHtml(data.targetRole)}` : ""
  }</p>
      <div class="cover-name-pill"><span>${escapeHtml(data.candidateName)}</span></div>

      <div class="cover-inside-box">
        <p class="cover-inside-heading">ما الذي يتضمّنه التقرير</p>
        <p class="cover-inside-item">· خارطة طريق تطويرك لمدة 30 / 60 / 90 يوماً</p>
        <p class="cover-inside-item">· إجراءات مستهدفة لكل كفاءة تطويرية</p>
        <p class="cover-inside-item">· نصائح عملية مستمدّة من نموذج كفاءات VIFM</p>
        <p class="cover-inside-item">· محفّزات تأمّل لحوارك التطويري القادم</p>
      </div>
    </div>
    <div class="cover-footer">
      <p>معهد فرجينيا للتمويل والإدارة · مرافق لتقرير تقييمك</p>
    </div>
  </section>

  <!-- PAGE 2 - 30/60/90 roadmap -->
  <section class="page">
    <p class="section-eyebrow">خطة العمل</p>
    <h2 class="section-title">خارطة طريقك لـ 30 / 60 / 90 يوماً</h2>
    <div class="section-rule"></div>

    <p class="body-text">في ما يلي خارطة طريقك التطويرية، مرتّبة من أكثر الفجوات إلحاحاً إلى الفرص الأبعد مدى. تعامل مع الأيام الثلاثين الأولى باعتبارها غير قابلة للتأجيل - فهناك يكمن أعلى أثر لتغيير السلوك.</p>

    <div class="timeline-row">
      ${phaseCardHtml("high", high)}
      ${phaseCardHtml("medium", medium)}
      ${phaseCardHtml("low", low)}
    </div>

    ${roadmapEmpty}
    ${footerHtml(data.candidateName)}
  </section>

  <!-- PAGE 3 - Per-competency action cards -->
  <section class="page">
    <p class="section-eyebrow">تطوير مستهدف</p>
    <h2 class="section-title">بطاقات الإجراءات لكل كفاءة</h2>
    <div class="section-rule"></div>

    ${competencyCards}

    <div class="closing-box">
      <h3 class="closing-heading">خذ هذه الخطة إلى حوارك التطويري القادم</h3>
      <p class="body-text" style="margin-bottom:4px">محفّزات مفيدة لمناقشتها مع مديرك أو مرشدك أو مدرّبك:</p>
      <p class="tip-text" style="margin-bottom:3px">· أيّ إجراءين من إجراءات «الآن» سألتزم بهما خلال الأسبوعين القادمين؟</p>
      <p class="tip-text" style="margin-bottom:3px">· أيّ مواقف عملية محدّدة يمكنني استثمارها للتدرّب على كل سلوك؟</p>
      <p class="tip-text" style="margin-bottom:3px">· من يستطيع أن يمنحني تغذية راجعة على هذه السلوكيات المحدّدة خلال التسعين يوماً القادمة؟</p>
      <p class="tip-text" style="margin-bottom:0">· كيف سأعرف أنني أحرزت تقدّماً - وما الذي يبدو عليه «الأداء الجيد»؟</p>
    </div>

    ${footerHtml(data.candidateName)}
  </section>

  ${coursesPage}

</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────
// Per-page footer (the EN Footer, in Arabic). Page numbers are left
// out because static HTML can't read the print page counter without
// a header/footer template; the EN React-PDF version uses a render
// callback that has no HTML equivalent here.
// ────────────────────────────────────────────────────────────────
function footerHtml(name: string): string {
  return `
    <div class="page-footer">
      <span class="confidential">سرّي للغاية</span>
      <span class="footer-text">${escapeHtml(name)} · خطة التعلّم</span>
    </div>`;
}
