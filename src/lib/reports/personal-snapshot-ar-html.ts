/**
 * Arabic / RTL HTML renderer for the Personal AI Readiness Snapshot
 * PDF. Pairs with React-PDF for English in the same route:
 *
 *   ar  → renderPersonalSnapshotHtmlAr → Puppeteer page.setContent → PDF
 *   en  → existing React-PDF PersonalSnapshot component
 *
 * React-PDF cannot shape Arabic glyphs (no harfbuzz / no font fallback)
 * which is why the EN path stays on it and the AR path goes via a
 * Chromium render - Chrome's text engine has full bidi + Arabic
 * shaping out of the box, so all we need to do is serve well-formed
 * RTL HTML with a real Arabic font loaded.
 *
 * Layout intentionally mirrors the React-PDF EN three-page layout
 * so the two versions feel like the same report:
 *
 *   Page 1 - score & how to read it
 *     Hero, scale legend, first two factor cards
 *   Page 2 - remaining factors
 *     Last two factor cards
 *   Page 3 - context & next steps
 *     "What this measures", stage-keyed next-steps panel, course
 *     recommendations (or empty-state), methodology footer
 *
 * All copy lives in this file so a translator can update the
 * Arabic copy in one place without touching the React-PDF EN code.
 */

import {
  ARA_INDIVIDUAL_FACTORS,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
  type AraIndividualMaturityStageId,
} from "@/lib/constants/ara-individual-factors";
import { VIFM_VERTICAL_LABELS, type VifmVertical } from "@/types/database";

// ────────────────────────────────────────────────────────────────
// Content - Arabic strings for everything the React-PDF template
// already renders in English. Written in Modern Standard Arabic
// with GCC-business register. Polish pass 2026-05-15 added Arabic
// punctuation (، ؛) where appropriate and tightened a handful of
// translated-from-English phrasings.
//
// ⚠️  STILL NEEDS NATIVE REVIEW before public-facing distribution.
// Use the EN renderer until a native Arabic professional has
// reviewed: register consistency, idiom freshness, and the
// terminology around AI-specific concepts (e.g. "hallucination",
// "prompt"). The CLAUDE.md "Important Notes" section already
// flags that Arabic competency translations are placeholders -
// that warning extends to this file too.
// ────────────────────────────────────────────────────────────────

/** Stage-keyed coaching per factor (4 factors × 3 stages = 12 blurbs). */
const FACTOR_GUIDANCE_AR: Record<
  AraIndividualFactorId,
  Record<AraIndividualMaturityStageId, string>
> = {
  thinking_sense_check: {
    emerging:
      "تعامل مع كل مخرجات الذكاء الاصطناعي كمسودة. ضع قائمة شخصية بـ«ما يجب التحقق منه دائماً» - الأرقام والأسماء والمراجع - ومرّ بها قبل تسليم أي عمل.",
    practising:
      "تتحقق من عمل الذكاء الاصطناعي، لكن بشكل تفاعلي في الغالب. حدّد محفزات صريحة (ادعاءات عالية المخاطر، مجالات غير مألوفة) تدفعك إلى التحقق تلقائياً؛ حتى لا تعتمد العادة على الشك.",
    embedded:
      "ترصد الهلوسة بشكل طبيعي. شارك أساليب التحقق مع فريقك ودوّنها في بروتوكول يستطيع الآخرون اتباعه حين لا تكون حاضراً.",
  },
  results_working_practice: {
    emerging:
      "اختر مهمة متكررة وادمج الذكاء الاصطناعي فيها لمدة أسبوعين، وتتبّع الوقت الموفّر - هذه البيانات تبني الثقة أسرع من التجريب العشوائي.",
    practising:
      "تستخدم الذكاء الاصطناعي في عمل حقيقي. استثمر الآن في قوالب التعليمات وسير العمل القابلة لإعادة الاستخدام؛ تتراكم الإنتاجية بدلاً من البدء من الصفر في كل مرة.",
    embedded:
      "الذكاء الاصطناعي جزء من طريقة عملك. دوّن أنماط سير العمل الأقوى لديك ليتبناها زملاؤك دون إعادة اختراع العجلة - يضاعف ذلك أثرك بعيداً عن لوحة مفاتيحك.",
  },
  people_collaboration: {
    emerging:
      "ابدأ بدور المترجم: حين يساعدك الذكاء الاصطناعي في مهمة، اشرح لزميل باختصار ما أبدع فيه وأين تدخّلت أنت. يفتح ذلك الحوار دون إحراج أحد.",
    practising:
      "تشارك بشكل مفيد. خذها خطوة أبعد: ادع زملاءك لطرح أسئلتهم عن الذكاء الاصطناعي عليك، وحدّد لقاءً منتظماً مدته 15 دقيقة ليقارن الفريق التعليمات والأنماط.",
    embedded:
      "أنت مضاعِف لتبنّي الذكاء الاصطناعي. ترصّد إشارات الاعتماد المفرط - زملاء يقبلون المخرجات دون تمحيص - وأشِر إليها بشكل بنّاء قبل أن تظهر في تسليم.",
  },
  self_adaptive_mindset: {
    emerging:
      "خصّص 30 دقيقة أسبوعياً لتعلّم قدرة جديدة في الذكاء الاصطناعي؛ ليس لاستخدامها، بل لمعرفة وجودها. الفضول هو المؤشر القائد لتحسّن كل عامل آخر.",
    practising:
      "تحافظ على فضولك. اختبر دورك الآن: اختر مهمة تتقنها واسأل «ماذا يحتاج الذكاء الاصطناعي ليؤديها أفضل؟» - يكشف ذلك أين تنحاز وأين تعمّق خبرتك.",
    embedded:
      "تتكيف بسلاسة. استثمر هذه القدرة في إرشاد شخص في بداية رحلته مع الذكاء الاصطناعي؛ التعليم يرسّخ تكيّفك ويكشف نقاط ضعفك.",
  },
};

/** Stage-keyed next-steps panel (3 stages × 3 bullets). */
const STAGE_NEXT_STEPS_AR: Record<
  AraIndividualMaturityStageId,
  { title: string; bullets: string[] }
> = {
  emerging: {
    title: "ركّز هنا تالياً",
    bullets: [
      "اختر العامل ذا الدرجة الأدنى وطبّق إرشاداته من الصفحة الأولى لمدة أسبوعين. لا تحاول رفع العوامل الأربعة دفعة واحدة.",
      "احجز في تقويمك جلسة أسبوعية ثابتة مدتها 30 دقيقة لممارسة الذكاء الاصطناعي. بدون موعد محدّد، لن تتشكّل العادة.",
      "ابحث عن زميل في فريقك متقدّم عليك في الذكاء الاصطناعي - زميل لا مدير - واطلب منه أن يشاركك تعليمة (Prompt) يثق بها. الاستعارة أسرع من البدء من الصفر.",
    ],
  },
  practising: {
    title: "ركّز هنا تالياً",
    bullets: [
      "تجاوزت مرحلة التجريب. حوّل أكثر ثلاث تفاعلات تكرّرها مع الذكاء الاصطناعي إلى تعليمات محفوظة بأسماء واضحة لتتوقف عن إعادة اختراعها.",
      "اقرن أقوى عامل لديك بأضعف عامل: استخدم القدرة التي بنيتها للتوسع في المنطقة التي تتجنبها. غالباً ما ترفع «الممارسة العملية» معها «تحقّق الذكاء الاصطناعي».",
      "اعرض هذا الشهر نتيجة ملموسة أنجزتها بمساعدة الذكاء الاصطناعي على مديرك أو فريقك: كسب في السرعة، تحسّن في الجودة، أو خطأ رصدته. الظهور يفتح أبواب الاستثمار.",
    ],
  },
  embedded: {
    title: "ركّز هنا تالياً",
    bullets: [
      "إتقانك الفردي راسخ. السقف التالي هو التأثير: اختر معياراً واحداً للفريق (التحقق، مشاركة التعليمات، قواعد التصعيد) واقترحه.",
      "راجع أحد مهامك المعتمدة على الذكاء الاصطناعي من زاويا الإنصاف والسرية ومطابقة السياسات. المستخدمون الراسخون يفاجئهم سوء الحوكمة، لا الأدوات.",
      "أرشد شخصاً في المرحلة الناشئة - التعليم يكشف ثغرات في نموذجك الخاص ويُصلب حُكمك.",
    ],
  },
};

/** Top-of-page-3 panels: "what this measures" + scale-band legend. */
const HOW_TO_USE_PANELS_AR = {
  read: {
    title: "كيف تقرأ هذه النتائج",
    bullets: [
      "1.0 - 2.9 - فرصة. منطقة إرساء الأساس؛ الممارسة المتعمَّدة ستحرّك العقرب بسرعة.",
      "3.0 - 3.9 - متطوّر. العادة قائمة؛ المكسب التالي هو جعلها موثوقة لا ظرفية.",
      "4.0 - 5.0 - قوي. تعمل بطلاقة؛ التحدّي الآن مشاركة الممارسة واختبارها.",
    ],
  },
  about: {
    title: "ما الذي يقيسه هذا التقييم",
    bullets: [
      "أربعة عوامل سلوكية تتنبأ بما إذا كانت أدوات الذكاء الاصطناعي ستتحوّل إلى نتائج فعلية لك، لا مجرد تجارب.",
      "كل عامل مرتبط بكفاءات مركز تقييم VIFM التي قد تعمل عليها فعلاً، فيتراكم نموّك في الذكاء الاصطناعي مع بقية مسار تطوّرك.",
      "هذه اللقطة تقرير ذاتي فقط. التشخيص المعمّق بقيادة استشاري يضاعف عدد البنود ويضيف مقارنات مع الأقران.",
    ],
  },
};

/** Tone-band metadata used by the factor cards. */
function toneForAr(score: number): { label: string; bg: string; fg: string; stageId: AraIndividualMaturityStageId } {
  if (score >= 4) return { label: "قوي", bg: "#dcfce7", fg: "#166534", stageId: "embedded" };
  if (score >= 3) return { label: "متطوّر", bg: "#fef3c7", fg: "#92400e", stageId: "practising" };
  return { label: "فرصة", bg: "#fee2e2", fg: "#991b1b", stageId: "emerging" };
}

/** VIFM brand palette (from CLAUDE.md). */
const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
  bgSoft: "#fafbfc",
};

// ────────────────────────────────────────────────────────────────
// HTML escape - covers <, >, &, ", '. Used on every dynamic string
// piped into the template so a respondent name with quotes or
// angle brackets can't break the PDF.
// ────────────────────────────────────────────────────────────────
function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ────────────────────────────────────────────────────────────────
// Public entrypoint - produces a complete HTML document string.
// Pass into Puppeteer's page.setContent({ waitUntil: 'networkidle0' }).
// ────────────────────────────────────────────────────────────────

export type PersonalSnapshotArData = {
  respondentName: string;
  respondentEmail: string;
  generatedAt: string;
  overallScore: number;
  factorScores: Record<AraIndividualFactorId, number>;
  recommendedCourses: Array<{
    course_id: string;
    title_en: string;
    title_ar: string | null;
    code: string | null;
    vertical: VifmVertical;
    level: string;
    duration_label: string;
    total_score: number;
    drivers: Array<{ label: string; gap: number; relevance: 1 | 2 | 3 }>;
  }>;
};

export function renderPersonalSnapshotHtmlAr(data: PersonalSnapshotArData): string {
  const stage = getIndividualMaturityStage(data.overallScore);
  const stageNext = STAGE_NEXT_STEPS_AR[stage.id];

  const factorCardsHtml = ARA_INDIVIDUAL_FACTORS.map((f) => {
    const score = data.factorScores[f.id] ?? 0;
    const tone = toneForAr(score);
    const guidance = score > 0 ? FACTOR_GUIDANCE_AR[f.id][tone.stageId] : null;
    return `
      <article class="factor-card">
        <div class="factor-top">
          <span class="factor-dot" style="background:${esc(f.color)}"></span>
          <span class="factor-domain">${esc(f.domain)}</span>
          ${score > 0 ? `<span class="factor-tone" style="background:${tone.bg};color:${tone.fg}">${esc(tone.label.toUpperCase())}</span>` : ""}
        </div>
        <h3 class="factor-name">${esc(f.name_ar)}</h3>
        <p class="factor-score"><span class="factor-score-num">${score > 0 ? score.toFixed(1) : "-"}</span><span class="factor-score-of"> / 5</span></p>
        <p class="factor-desc">${esc(f.description_ar)}</p>
        ${guidance ? `
          <p class="factor-guidance-label">ركّز هنا تالياً</p>
          <p class="factor-guidance">${esc(guidance)}</p>
        ` : ""}
        <p class="factor-competencies">المرتبط بكفاءات مركز تقييم VIFM: ${f.ac_competency_names.map(esc).join(" · ")}</p>
      </article>
    `;
  }).join("");

  const coursesHtml = data.recommendedCourses.length > 0
    ? data.recommendedCourses.slice(0, 5).map((c) => {
        const isHighFit = c.total_score >= 4;
        const titleAr = c.title_ar ?? c.title_en;
        const vertical = VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical;
        const level = c.level.charAt(0).toUpperCase() + c.level.slice(1);
        const drivers = c.drivers.map((d) => `<span class="driver-chip">${esc(d.label)} · فجوة ${d.gap} × ×${d.relevance}</span>`).join("");
        return `
          <article class="course-card">
            <header class="course-head">
              <div class="course-title-wrap">
                <h4 class="course-title">${esc(titleAr)}</h4>
                ${c.code ? `<span class="course-code">${esc(c.code)}</span>` : ""}
              </div>
              ${isHighFit ? `<span class="course-fit">★ ملاءمة عالية · ${c.total_score}</span>` : `<span class="course-fit-mute">ملاءمة · ${c.total_score}</span>`}
            </header>
            <div class="course-meta">
              <span class="meta-pill">${esc(vertical)}</span>
              <span class="meta-pill">${esc(level)}</span>
              <span class="meta-pill">${esc(c.duration_label)}</span>
            </div>
            <div class="course-drivers">${drivers}</div>
          </article>
        `;
      }).join("")
    : `
      <div class="empty-courses">
        <h4>لا توجد توصيات مستهدفة في هذه الجولة</h4>
        <p>أنت قريب من المستوى المستهدف أو تخطّيته في العوامل الأربعة، أو أن الفجوات القائمة تقع خارج تغطية كتالوج VIFM الحالي. تصفّح قائمة البرامج الكاملة على caliber.viftraining.com لتختار مجالات تطوير ليست مرتبطة بفجوة مقاسة، أو عُد إلى هذه اللقطة بعد ممارسة مركّزة لترى التوصيات تتغيّر.</p>
      </div>
    `;

  const fitExplainerHtml = data.recommendedCourses.length > 0 ? `
    <div class="fit-explainer">
      <p>
        <strong>كيف تقرأ هذه التوصيات.</strong>
        كل شريحة أدناه تمثّل تطابقاً واحداً بين دورة وعامل سجّلت فيه أقل من المستوى المستهدف 4 / 5.
        الصيغة <code>فجوة N × ×R</code> تعني فجوتك إلى المستهدف (N) مضروبة بقوة ارتباط الدورة بكفاءات ذلك العامل
        (الأهمية <code>×1</code> منخفضة، <code>×2</code> متوسطة، <code>×3</code> قوية).
        <strong>درجة الملاءمة</strong> هي حاصل جمع كل التطابقات.
        <strong>★ ملاءمة عالية</strong> يعني درجة ملاءمة 4 فأكثر.
      </p>
    </div>
  ` : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>لقطة الجاهزية الشخصية للذكاء الاصطناعي · ${esc(data.respondentName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      color: ${C.text};
      font-size: 11pt;
      line-height: 1.55;
      background: #fff;
    }
    @page { size: A4; margin: 14mm 14mm 16mm 14mm; }

    /* Reusable */
    .page-break-before { page-break-before: always; }
    .page-break-avoid { page-break-inside: avoid; }
    .muted { color: ${C.textLight}; }
    code { font-family: Consolas, monospace; font-size: 0.92em; }

    /* Hero */
    .hero {
      background: ${C.primary};
      color: #fff;
      padding: 22px 26px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .hero-eyebrow {
      font-size: 9pt;
      letter-spacing: 0.18em;
      opacity: 0.7;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .hero-title { font-size: 22pt; font-weight: 700; margin: 0 0 4px 0; }
    .hero-identity { font-size: 11pt; opacity: 0.85; margin: 0 0 14px 0; }
    .hero-score-row { display: flex; align-items: baseline; gap: 12px; }
    .hero-score-num { font-size: 36pt; font-weight: 700; line-height: 1; }
    .hero-score-of { font-size: 11pt; opacity: 0.6; }
    .hero-stage {
      display: inline-block;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.18em;
      background: rgba(255,255,255,0.18);
      padding: 4px 10px;
      border-radius: 12px;
      margin: 10px 0;
    }
    .hero-verdict { font-size: 10pt; opacity: 0.9; max-width: 540px; margin: 8px 0 0; line-height: 1.55; }

    /* Section headers */
    .section-eyebrow {
      font-size: 8pt;
      letter-spacing: 0.18em;
      color: ${C.accent};
      text-transform: uppercase;
      font-weight: 700;
      margin: 12px 0 4px;
    }
    .section-title { font-size: 14pt; font-weight: 700; color: ${C.primary}; margin: 0 0 6px 0; }
    .section-rule { width: 32px; height: 2px; background: ${C.accent}; margin-bottom: 12px; }

    /* Scale legend */
    .legend {
      border: 0.5pt solid ${C.border};
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
      background: ${C.bgSoft};
    }
    .legend-title { font-size: 10pt; font-weight: 700; color: ${C.primary}; margin: 0 0 6px; }
    .legend-row { display: flex; gap: 10px; }
    .legend-cell { flex: 1; display: flex; align-items: center; gap: 8px; }
    .legend-pill {
      font-size: 8pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 8px;
      white-space: nowrap;
    }
    .legend-text { font-size: 9pt; color: ${C.textLight}; }

    /* Factor cards (2-up grid) */
    .factor-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .factor-card {
      border: 0.5pt solid ${C.border};
      border-radius: 6px;
      padding: 12px;
      break-inside: avoid;
    }
    .factor-top { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
    .factor-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
    .factor-domain {
      font-size: 7.5pt;
      letter-spacing: 0.18em;
      font-weight: 700;
      color: ${C.textLight};
      text-transform: uppercase;
    }
    .factor-tone {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 8px;
      margin-inline-start: auto;
    }
    .factor-name { font-size: 11.5pt; font-weight: 700; color: ${C.primary}; margin: 4px 0 0; }
    .factor-score { margin: 4px 0 6px; }
    .factor-score-num { font-size: 18pt; font-weight: 700; color: ${C.primary}; }
    .factor-score-of { font-size: 9pt; color: ${C.textLight}; }
    .factor-desc { font-size: 9pt; color: ${C.textLight}; margin: 0 0 6px; line-height: 1.55; }
    .factor-guidance-label {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: ${C.accent};
      text-transform: uppercase;
      margin: 6px 0 2px;
    }
    .factor-guidance { font-size: 9pt; color: ${C.text}; margin: 0 0 6px; line-height: 1.55; }
    .factor-competencies {
      font-size: 8pt;
      color: ${C.textMuted};
      font-style: italic;
      margin: 6px 0 0;
    }

    /* Two-col context panels */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .key-panel {
      border: 0.5pt solid ${C.border};
      border-radius: 6px;
      padding: 12px;
      background: ${C.bgSoft};
    }
    .key-panel h4 { font-size: 10pt; font-weight: 700; color: ${C.primary}; margin: 0 0 6px; }
    .key-panel ul { list-style: disc; padding-inline-start: 18px; margin: 0; }
    .key-panel li { font-size: 9.5pt; line-height: 1.55; margin: 4px 0; color: ${C.text}; }

    /* Fit explainer */
    .fit-explainer {
      border: 0.5pt solid ${C.border};
      border-radius: 6px;
      padding: 11px 13px;
      margin-bottom: 10px;
      background: ${C.bgSoft};
    }
    .fit-explainer p { margin: 0; font-size: 9pt; line-height: 1.6; color: ${C.text}; }
    .fit-explainer code {
      background: #fff;
      border: 0.5pt solid ${C.border};
      padding: 0 4px;
      border-radius: 3px;
    }

    /* Course cards */
    .course-card {
      border: 0.5pt solid ${C.border};
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 8px;
      background: ${C.bgSoft};
      break-inside: avoid;
    }
    .course-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .course-title-wrap { flex: 1; }
    .course-title { font-size: 11pt; font-weight: 700; color: ${C.primary}; margin: 0; display: inline; }
    .course-code { font-size: 8pt; color: ${C.textLight}; margin-inline-start: 6px; font-family: Consolas, monospace; }
    .course-fit {
      font-size: 8pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      background: #fef3c7;
      color: #92400e;
      white-space: nowrap;
    }
    .course-fit-mute {
      font-size: 8pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      background: #fff;
      border: 0.5pt solid ${C.border};
      color: ${C.text};
      white-space: nowrap;
    }
    .course-meta { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
    .meta-pill {
      font-size: 8pt;
      padding: 2px 8px;
      border-radius: 10px;
      border: 0.5pt solid ${C.border};
      background: #fff;
      color: ${C.text};
    }
    .course-drivers { display: flex; flex-wrap: wrap; gap: 4px; }
    .driver-chip {
      font-size: 7.5pt;
      padding: 2px 7px;
      border-radius: 8px;
      border: 0.5pt solid #bfdbfe;
      background: #eff6ff;
      color: #1e40af;
    }
    .empty-courses {
      border: 0.5pt solid ${C.border};
      border-radius: 6px;
      padding: 14px;
      background: ${C.bgSoft};
      margin-bottom: 12px;
    }
    .empty-courses h4 { font-size: 11pt; font-weight: 700; color: ${C.primary}; margin: 0 0 4px; }
    .empty-courses p { font-size: 10pt; color: ${C.textLight}; margin: 0; line-height: 1.6; }

    /* Methodology */
    .method-box {
      border-top: 0.5pt solid ${C.border};
      padding-top: 12px;
      margin-top: 8px;
    }
    .method-box h4 { font-size: 10pt; font-weight: 700; color: ${C.primary}; margin: 0 0 4px; }
    .method-box p { font-size: 9pt; color: ${C.textLight}; line-height: 1.6; margin: 0 0 4px; }
    .method-link { font-size: 9pt; color: ${C.accent}; font-family: Consolas, monospace; }

    /* Footer at the bottom of each page */
    .page-footer {
      position: fixed;
      bottom: 6mm;
      left: 14mm;
      right: 14mm;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: ${C.textMuted};
      border-top: 0.5pt solid ${C.border};
      padding-top: 4px;
    }
  </style>
</head>
<body>

  <!-- PAGE 1 - score + per-factor (first two) -->
  <section>
    <div class="hero">
      <p class="hero-eyebrow">بوصلة VIFM للاستعداد للذكاء الاصطناعي · شخصية</p>
      <h1 class="hero-title">لقطة الجاهزية الشخصية للذكاء الاصطناعي</h1>
      <p class="hero-identity">${esc(data.respondentName)} · ${esc(data.respondentEmail)}</p>
      <div class="hero-score-row">
        <span class="hero-score-num">${data.overallScore.toFixed(1)}</span>
        <span class="hero-score-of">/ 5 إجمالي</span>
      </div>
      ${data.overallScore > 0 ? `<span class="hero-stage">${esc(stage.name_ar)}</span>` : ""}
      <p class="hero-verdict">${data.overallScore > 0 ? esc(stage.blurb_ar) : "لا توجد بيانات بعد."}</p>
    </div>

    <div class="legend">
      <p class="legend-title">${esc(HOW_TO_USE_PANELS_AR.read.title)}</p>
      <div class="legend-row">
        <div class="legend-cell">
          <span class="legend-pill" style="background:#fee2e2;color:#991b1b">فرصة</span>
          <span class="legend-text">1.0 - 2.9</span>
        </div>
        <div class="legend-cell">
          <span class="legend-pill" style="background:#fef3c7;color:#92400e">متطوّر</span>
          <span class="legend-text">3.0 - 3.9</span>
        </div>
        <div class="legend-cell">
          <span class="legend-pill" style="background:#dcfce7;color:#166534">قوي</span>
          <span class="legend-text">4.0 - 5.0</span>
        </div>
      </div>
    </div>

    <p class="section-eyebrow">تفصيل لكل عامل</p>
    <h2 class="section-title">موقعك في كل عامل من عوامل VIFM</h2>
    <div class="section-rule"></div>
    <div class="factor-grid">${factorCardsHtml}</div>
  </section>

  <!-- PAGE 2 break -->
  <section class="page-break-before">
    <p class="section-eyebrow">كيف تستخدم هذه اللقطة</p>
    <h2 class="section-title">قراءة نتيجتك في سياقها</h2>
    <div class="section-rule"></div>

    <div class="two-col">
      <div class="key-panel">
        <h4>${esc(HOW_TO_USE_PANELS_AR.about.title)}</h4>
        <ul>${HOW_TO_USE_PANELS_AR.about.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>
      <div class="key-panel">
        <h4>${esc(stageNext.title)} · ${esc(stage.name_ar)}</h4>
        <ul>${stageNext.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>
    </div>

    <p class="section-eyebrow">تدريب مستهدف</p>
    <h2 class="section-title">تطوّر مع برامج VIFM</h2>
    <div class="section-rule"></div>
    ${fitExplainerHtml}
    ${coursesHtml}

    <div class="method-box">
      <h4>كيف بنينا هذا التقييم</h4>
      <p>إطار من أربعة عوامل، 24 بنداً للتقرير الذاتي على مقياس ليكرت من 1 إلى 5، تُحتسب كمتوسط غير مرجّح لكل عامل. ترتبط العوامل بنموذج كفاءات السلوك في مركز تقييم VIFM ليتوافق استعداد الفرد للذكاء الاصطناعي مع العمل التطويري الذي تقوم به أصلاً. هذه لقطة - أما التشخيص المعمّق بقيادة استشاري مدفوع فيضاعف عدد البنود ويضيف مقارنات مع الأقران ومناقشة منظمة للنتائج.</p>
      <p class="method-link">github.com/AimanSadeq/vifm-assessment-center/blob/master/docs/ARA-Methodology-Brief.md</p>
    </div>
  </section>

  <div class="page-footer">
    <span>بوصلة VIFM للاستعداد للذكاء الاصطناعي · لقطة شخصية</span>
    <span>أُنشئت في ${esc(data.generatedAt)}</span>
  </div>

</body>
</html>`;
}
