// ─────────────────────────────────────────────────────────────
// Persona profile - ARABIC / RTL renderer (item 12, Tier 2).
//
// React-PDF cannot shape Arabic glyphs, so the Arabic report is produced from
// well-formed RTL HTML through Chromium (renderHtmlToPdfBuffer). It consumes the
// SAME PersonaPdfData the EN React-PDF renderer uses, so the two languages never
// drift; only the chrome (static labels) lives here, in one place, for a
// translator. Covers both purposes and all sections A to E. Markers are inline
// SVG (no emoji / icon-font). Numbers are wrapped dir="ltr" so they read
// correctly inside RTL text.
// ─────────────────────────────────────────────────────────────

import { AR_FONT_HREF, escapeHtml } from "@/lib/reports/html-to-pdf";
import { personaBand } from "@/lib/scoring/persona-bands";
import type { PersonaPdfData } from "@/lib/reports/persona-profile";

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  border: "#e5e7eb",
  emerald: "#059669",
  amber: "#b45309",
  rose: "#b91c1c",
};

// Western digits inside RTL flow - wrap so bidi keeps "3.8 / 5" left-to-right.
const num = (v: string | number) => `<span dir="ltr">${escapeHtml(String(v))}</span>`;
// Keep the digits AND the percent sign together inside one LTR run so the bare
// '%' (a bidi European Terminator) is not displaced in the RTL paragraph.
const numPct = (v: string | number) => `<span dir="ltr">${escapeHtml(String(v))}%</span>`;
const f1 = (n: number) => n.toFixed(1);

function ordinalAr(n: number): string {
  return `${num(n)} مئيني`;
}

// ── inline SVG markers ──
const roleMark = (kind: "critical" | "role") =>
  `<svg width="9" height="9" viewBox="0 0 8 8" style="margin-inline-start:4px;vertical-align:middle"><polygon points="4,0 8,4 4,8 0,4" fill="${kind === "critical" ? C.accent : "#ffffff"}" stroke="${C.accent}" stroke-width="1"/></svg>`;
const cautionMark = `<svg width="11" height="11" viewBox="0 0 10 10" style="margin-inline-start:4px;vertical-align:middle"><polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="none" stroke="${C.amber}" stroke-width="1"/><line x1="5" y1="3.5" x2="5" y2="6.5" stroke="${C.amber}" stroke-width="1"/><circle cx="5" cy="8.2" r="0.6" fill="${C.amber}"/></svg>`;
const bullet = (color: string) =>
  `<svg width="6" height="6" viewBox="0 0 5 5" style="margin-inline-start:6px;vertical-align:middle"><circle cx="2.5" cy="2.5" r="2" fill="${color}"/></svg>`;
const checkMark = `<svg width="10" height="10" viewBox="0 0 10 10" style="margin-inline-start:4px;vertical-align:middle"><path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke="${C.emerald}" stroke-width="1.4"/></svg>`;

function bandColor(v: number) {
  return v >= 4 ? C.emerald : v >= 3 ? C.accent : C.amber;
}

export function renderPersonaProfileHtmlAr(data: PersonaPdfData): string {
  const dev = data.purpose === "development";
  const hiring = data.purpose === "hiring";

  const subtitle = hiring
    ? "قراءة ملاءمة الدور عبر إطار جدارات VIFM (الإطار نفسه المستخدم في تقييم 360)"
    : "قراءة تطويرية عبر إطار جدارات VIFM (الإطار نفسه المستخدم في تقييم 360)";

  const parts: string[] = [];

  // Banner
  parts.push(`<div class="banner">
    <div class="eyebrow">بيرسونا® - التقييم الذاتي السلوكي</div>
    <div class="title">${escapeHtml(data.takerName || "ملف ذاتي")}</div>
    <div class="subtitle">${subtitle}</div>
  </div>`);

  // B.1 summary (development)
  if (dev && data.summary) {
    parts.push(`<div class="panel"><div class="sec-title">ملخص ملفك</div><p class="para">${escapeHtml(data.summary)}</p></div>`);
  }

  // Fit / development panel
  if (data.fit) {
    const fitBlocks: string[] = [];

    if (hiring && data.watchAreas && data.watchAreas.length > 0) {
      fitBlocks.push(`<div class="watch">
        <div class="watch-title">${cautionMark}<span>مجالات للتحقق في المقابلة</span></div>
        <div class="watch-body">جدارات حسّاسة للدور قيّمها المرشّح أقل بكثير من المستهدف. تحقّق منها بالأدلة؛ هذا تنبيه للاستقصاء وليس سببًا للرفض: ${escapeHtml(data.watchAreas.join("، "))}.</div>
      </div>`);
    }

    if (dev) {
      fitBlocks.push(`<div class="fit-label">خطة التطوير · ${escapeHtml(data.fit.roleName)}</div>
        <div class="fit-value" style="color:${C.primary}">${numPct(data.fit.fitPct)} متوافق مع مستهدف الدور</div>`);
    } else {
      fitBlocks.push(`<div class="fit-label">ملاءمة الدور · ${escapeHtml(data.fit.roleName)}</div>
        <div class="fit-value" style="color:${escapeHtml(data.fit.bandHex)}">${numPct(data.fit.fitPct)} · ${escapeHtml(data.fit.bandLabel)}</div>`);
    }

    if (data.fit.strengths && data.fit.strengths.length > 0) {
      fitBlocks.push(`<div class="fit-gap-title" style="color:${C.emerald}">${dev ? "نقاط القوة للاستثمار (ذاتي / مستهدف)" : "أبرز نقاط القوة (ذاتي / مستهدف)"}</div>`);
      for (const g of data.fit.strengths) {
        fitBlocks.push(`<div class="gap-row"><span>${escapeHtml(g.name)}</span><span style="color:${C.emerald}">${num(f1(g.self))} / ${num(f1(g.target))}</span></div>`);
      }
    }
    if (data.fit.gaps.length > 0) {
      fitBlocks.push(`<div class="fit-gap-title">${dev ? "أولويات التطوير (ذاتي / مستهدف)" : "أكبر الفجوات مقابل المستهدف (ذاتي / مستهدف)"}</div>`);
      for (const g of data.fit.gaps) {
        fitBlocks.push(`<div class="gap-row"><span>${escapeHtml(g.name)}</span><span style="color:${dev ? C.amber : C.rose}">${num(f1(g.self))} / ${num(f1(g.target))} (-${num(f1(g.gap))})</span></div>`);
      }
    } else {
      fitBlocks.push(`<div class="fit-gap-title">يحقّق أو يتجاوز كل المستهدفات.</div>`);
    }

    fitBlocks.push(
      dev
        ? `<div class="fit-note">خطة تطوير قائمة على تقييم ذاتي - اقرنها بتقييم ريفلكت 360 (رأي الآخرين) وببرامج VIFM الموصى بها أدناه لتحويل الأولويات إلى تقدّم.</div>`
        : `<div class="fit-caveat">إشارة فرز قائمة على تقييم ذاتي - تحقّق منها بتقييم 360 ومقابلة وأدلة قبل أي قرار توظيف.</div>`,
    );

    if (data.consistency) {
      const cls = data.consistency.flag === "review" && hiring ? "consist-review" : "consist-ok";
      const word = data.consistency.flag === "review" ? "مراجعة" : "متّسق";
      fitBlocks.push(`<div class="${cls}">نمط الاستجابة: ${word} - ${escapeHtml(data.consistency.note)}</div>`);
    }
    if (data.normGroupLabel) {
      const prov = data.normProvisional ? ` (أوّلية${data.normN ? `، n=${num(data.normN)}` : ""})` : data.normN ? `، n=${num(data.normN)}` : "";
      fitBlocks.push(`<div class="norm-note">النسب المئوية مقارنةً بـ ${escapeHtml(data.normGroupLabel)}${prov}، وهي مبنية على تقييم ذاتي.</div>`);
    }

    parts.push(`<div class="panel">${fitBlocks.join("")}</div>`);
  }

  // A.1 interview guide (hiring)
  if (hiring && data.interviewProbes && data.interviewProbes.length > 0) {
    const groups = data.interviewProbes
      .map(
        (grp) => `<div class="iv-group">
        <div class="iv-head">${roleMark("critical")}<span class="iv-name">${escapeHtml(grp.name)}</span></div>
        ${grp.probes.map((p, i) => `<div class="iv-probe">${num(i + 1)}. ${escapeHtml(p)}</div>`).join("")}
        <div class="iv-evidence">الأدلة / التقييم (1-5): ______________________________</div>
      </div>`,
      )
      .join("");
    parts.push(`<div class="panel">
      <div class="sec-title">دليل المقابلة</div>
      <div class="sec-sub">أسئلة سلوكية (STAR) للجدارات الحسّاسة للدور، مبنية على إجابات المرشّح الأقل تقييمًا. أداة فرز؛ سجّل الأدلة وتقييمك.</div>
      ${groups}
    </div>`);
  }

  // A.2 decision integration (hiring)
  if (hiring && data.fit) {
    const watch = data.fit.gaps.length > 0 ? `. للانتباه: ${escapeHtml(data.fit.gaps.slice(0, 2).map((g) => g.name).join("، "))}` : "";
    parts.push(`<div class="panel">
      <div class="sec-title">دمج القرار</div>
      <div class="sec-sub">ادمج إشارة التقييم مع أدلة المقابلة في توصية موثّقة. تكملها اللجنة؛ بيرسونا لا يحسب القرار.</div>
      <div class="dec-row"><span class="dec-label">إشارة التقييم</span><span class="dec-value">${numPct(data.fit.fitPct)} · ${escapeHtml(data.fit.bandLabel)}${watch}</span></div>
      <div class="dec-row"><span class="dec-label">تقييم المقابلة (1-5)</span><span class="dec-blank">____________________________________________</span></div>
      <div class="dec-row"><span class="dec-label">الأدلة / ملاحظات</span><span class="dec-blank">____________________________________________</span></div>
      <div class="dec-row"><span class="dec-label">التوصية النهائية</span><span class="dec-value">ترشيح&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;تأجيل&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;رفض</span></div>
      <div class="fit-caveat">إشارة فرز قائمة على تقييم ذاتي - تحقّق منها بتقييم 360 ومقابلة وأدلة قبل أي قرار توظيف.</div>
    </div>`);
  }

  // Academy (development)
  if (dev && data.courses && data.courses.length > 0) {
    const cards = data.courses
      .map(
        (c) => `<div class="course">
        <div class="course-head">
          <div><div class="course-title">${escapeHtml(c.title)}${c.highFit ? ` <span class="hf">ملاءمة عالية</span>` : ""}</div>
          <div class="course-meta">${escapeHtml(c.vertical)} · ${escapeHtml(c.level)} · ${num(c.durationLabel)}${c.code ? ` · ${escapeHtml(c.code)}` : ""}</div></div>
          ${c.fitOutOfTen > 0 ? `<div class="course-fit">${num(c.fitOutOfTen)}/10</div>` : ""}
        </div>
        ${c.drivers.length > 0 ? `<div class="course-driver">${c.drivers.map((d) => `${escapeHtml(d.label)} (فجوة ${num(f1(d.gap))} ×${num(d.relevance)})`).join("   ·   ")}</div>` : ""}
      </div>`,
      )
      .join("");
    parts.push(`<div class="panel academy">
      <div class="sec-title">برامج أكاديمية VIFM الموصى بها</div>
      <div class="sec-sub">مرتبطة بأولويات تطويرك - مرتّبة حسب حجم الفجوة ومدى استهداف كل برنامج لها.</div>
      ${cards}
    </div>`);
  }

  // B.3 coaching (development)
  if (dev && data.coaching && (data.coaching.forConversation.length > 0 || data.coaching.forSelf.length > 0)) {
    const conv = data.coaching.forConversation.length
      ? `<div class="coach-col"><div class="coach-head">لمحادثة التطوير</div>${data.coaching.forConversation.map((q) => `<div class="coach-item">${bullet(C.accent)}<span>${escapeHtml(q)}</span></div>`).join("")}</div>`
      : "";
    const self = data.coaching.forSelf.length
      ? `<div class="coach-col"><div class="coach-head">أسئلة تطرحها على نفسك</div>${data.coaching.forSelf.map((q) => `<div class="coach-item">${bullet("#c026d3")}<span>${escapeHtml(q)}</span></div>`).join("")}</div>`
      : "";
    parts.push(`<div class="panel"><div class="sec-title">أسئلة للنقاش</div>${conv}${self}</div>`);
  }

  // Overall
  const overallPct = data.overallPercentile != null
    ? `<div class="overall-pct">${ordinalAr(data.overallPercentile)} مقابل ${escapeHtml(data.normGroupLabel ?? "مجموعة المقارنة")}</div>`
    : "";
  parts.push(`<div class="overall">
    <div class="overall-label">متوسط التقييم الذاتي</div>
    <div class="overall-value" style="color:${bandColor(data.overall)}">${num(data.overall.toFixed(2))} / 5 · ${escapeHtml(personaBand(data.overall).labelAr)}</div>
    ${overallPct}
  </div>`);

  // Clusters
  for (const cl of data.clusters) {
    const rows = cl.rows
      .map((r) => {
        const mark = hiring && r.roleMark ? roleMark(r.roleMark) : "";
        const target = hiring && r.target != null ? ` / ${num(f1(r.target))}` : "";
        const pct = r.percentile != null ? ` · ${ordinalAr(r.percentile)}` : "";
        const overuse =
          dev && r.overused
            ? `<div class="row-overuse">${checkMark}<span>قوة حقيقية: حافظ عليها واحرص ألا تطغى على الجدارات الأدنى.</span></div>`
            : "";
        return `<div class="row">
          <div class="row-head">
            <span class="row-name">${mark}${escapeHtml(r.name)}</span>
            <span class="row-score">${num(f1(r.score))}${target}${pct} · ${escapeHtml(personaBand(r.score).labelAr)}</span>
          </div>
          ${r.definition ? `<div class="row-def">${escapeHtml(r.definition)}</div>` : ""}
          <div class="bar-track"><div class="bar-fill" style="width:${(r.score / 5) * 100}%"></div></div>
          ${r.narrative ? `<div class="row-narr">${escapeHtml(r.narrative)}</div>` : ""}
          ${r.tip ? `<div class="row-tip">اقتراح: ${escapeHtml(r.tip)}</div>` : ""}
          ${overuse}
        </div>`;
      })
      .join("");
    parts.push(`<div class="cluster">
      <div class="cluster-head"><span class="cluster-name">${escapeHtml(cl.name)}</span><span class="cluster-avg" style="color:${bandColor(cl.avg)}">${num(f1(cl.avg))} · ${escapeHtml(personaBand(cl.avg).labelAr)}</span></div>
      ${rows}
    </div>`);
  }

  // B.2 planning scaffold (development) - the take-away action plan, at the end.
  if (dev && data.planRows && data.planRows.length > 0) {
    const rows = data.planRows
      .map(
        (p, i) => `<div class="plan-card">
        <div class="plan-comp">${num(i + 1)}. ${escapeHtml(p.competency)}</div>
        <div class="plan-action">الإجراء / التحدي: ${escapeHtml(p.action)}</div>
        <div class="plan-blank"><span class="pb-label">هدف التطوير</span><span class="pb-line"></span></div>
        <div class="plan-blank"><span class="pb-label">التطبيق في العمل</span><span class="pb-line"></span></div>
        <div class="plan-blank"><span class="pb-label">مقياس النجاح</span><span class="pb-line"></span></div>
        <div class="plan-blank"><span class="pb-label">المراجعة بحلول</span><span class="pb-line"></span></div>
      </div>`,
      )
      .join("");
    parts.push(`<div class="panel">
      <div class="sec-title">خطة تطويرك</div>
      <div class="sec-sub">لكل أولوية: حدّد هدفًا، طبّقه في العمل، وقرّر كيف ستعرف أنه نجح. أكمل الفراغات مع مديرك أو مرشدك.</div>
      ${rows}
    </div>`);
  }

  // Caption + methodology
  parts.push(`<div class="caption">${
    hiring
      ? "هذا تقرير ذاتي استرشادي للملاءمة مقابل الدور - إشارة فرز وليست قرار توظيف. تحقّق منه بتقييم ريفلكت 360 (الآخرون) ومقابلة منظّمة وأدلة عمل."
      : "هذا تقرير ذاتي استرشادي - كيف ترى نفسك عبر الجدارات. لتحويله إلى حكم على الجاهزية، اقرن بيرسونا (الذات) بتقييم ريفلكت 360 (الآخرون) مقابل دور مستهدف."
  }</div>`);
  parts.push(`<div class="method-note">المنهجية: بيرسونا تقييم ذاتي سلوكي من 1 إلى 5 يُحتسب لكل جدارة (مع عكس العبارات السالبة)، ويُجمَّع حسب المجموعات، ويُقارن بدور مستهدف وبمجموعة معيارية عند توفّرها. هو إشارة تقييم ذاتي وليس قياسًا موضوعيًا ولا قرارًا. راجع موجز منهجية بيرسونا للتفاصيل الكاملة.</div>`);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${AR_FONT_HREF}" rel="stylesheet" />
<style>
  @page { size: A4; margin: 14mm 12mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Naskh Arabic", serif; color: ${C.text}; font-size: 11px; line-height: 1.6; margin: 0; }
  .banner { background: ${C.primary}; border-radius: 6px; padding: 16px 18px; margin-bottom: 14px; }
  .eyebrow { color: ${C.accent}; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
  .title { color: #fff; font-size: 20px; font-weight: 700; margin-top: 4px; }
  .subtitle { color: #fff; opacity: 0.85; font-size: 11px; margin-top: 2px; }
  .panel { border: 1px solid ${C.border}; border-radius: 6px; padding: 11px; margin-bottom: 12px; background: #fafbfc; page-break-inside: avoid; }
  .academy { border-color: ${C.accent}; background: #f5f9fe; }
  .sec-title { font-size: 12px; font-weight: 700; color: ${C.primary}; margin-bottom: 3px; }
  .sec-sub { font-size: 9px; color: ${C.textLight}; margin-bottom: 6px; }
  .para { font-size: 11px; color: ${C.text}; }
  .fit-label { font-size: 9px; color: ${C.textLight}; letter-spacing: 0.5px; }
  .fit-value { font-size: 20px; font-weight: 700; margin-top: 2px; }
  .fit-gap-title { font-size: 10px; color: ${C.textLight}; margin-top: 8px; margin-bottom: 3px; }
  .gap-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 10px; }
  .fit-note { font-size: 9px; color: ${C.primary}; margin-top: 8px; }
  .fit-caveat { font-size: 9px; color: ${C.amber}; margin-top: 8px; }
  .norm-note { font-size: 8.5px; color: ${C.textLight}; margin-top: 6px; }
  .consist-ok { font-size: 9px; color: ${C.textLight}; margin-top: 8px; }
  .consist-review { font-size: 9px; color: ${C.amber}; font-weight: 700; margin-top: 8px; }
  .watch { border: 1px solid #fcd34d; background: #fffbeb; border-radius: 5px; padding: 8px; margin-bottom: 8px; }
  .watch-title { font-weight: 700; color: ${C.amber}; font-size: 10px; margin-bottom: 2px; }
  .watch-body { font-size: 9.5px; color: ${C.amber}; }
  .iv-group { margin-bottom: 8px; page-break-inside: avoid; }
  .iv-head { margin-bottom: 2px; }
  .iv-name { font-size: 11px; font-weight: 700; color: ${C.primary}; }
  .iv-probe { font-size: 10px; color: ${C.text}; margin-bottom: 2px; }
  .iv-evidence { font-size: 9px; color: ${C.textLight}; margin-top: 2px; }
  .dec-row { display: flex; border-bottom: 1px solid ${C.border}; padding: 5px 0; }
  .dec-label { width: 140px; font-size: 10px; font-weight: 700; color: ${C.primary}; }
  .dec-value { flex: 1; font-size: 10px; }
  .dec-blank { flex: 1; font-size: 10px; color: ${C.textLight}; }
  .course { border: 1px solid ${C.border}; border-radius: 5px; padding: 8px; margin-bottom: 6px; background: #fff; }
  .course-head { display: flex; justify-content: space-between; align-items: flex-start; }
  .course-title { font-size: 11px; font-weight: 700; }
  .hf { font-size: 8px; color: #92400e; background: #fef3c7; border-radius: 8px; padding: 1px 6px; }
  .course-meta { font-size: 9px; color: ${C.textLight}; margin-top: 1px; }
  .course-fit { font-size: 11px; font-weight: 700; color: ${C.primary}; }
  .course-driver { font-size: 8.5px; color: ${C.accent}; margin-top: 2px; }
  .plan-card { border: 1px solid ${C.border}; border-radius: 5px; padding: 8px; margin-bottom: 6px; background: #fff; page-break-inside: avoid; }
  .plan-comp { font-size: 11px; font-weight: 700; color: ${C.primary}; }
  .plan-action { font-size: 9.5px; margin-top: 2px; }
  .plan-blank { display: flex; margin-top: 3px; align-items: flex-end; }
  .pb-label { font-size: 9px; color: ${C.textLight}; width: 120px; }
  .pb-line { flex: 1; border-bottom: 1px solid #d1d5db; height: 12px; }
  .coach-col { margin-bottom: 6px; }
  .coach-head { font-size: 10px; font-weight: 700; color: ${C.primary}; margin-bottom: 3px; }
  .coach-item { font-size: 9.5px; margin-bottom: 2px; }
  .overall { margin: 10px 0 12px; }
  .overall-label { font-size: 9px; color: ${C.textLight}; }
  .overall-value { font-size: 22px; font-weight: 700; }
  .overall-pct { font-size: 9px; color: ${C.textLight}; margin-top: 2px; }
  .cluster { margin-bottom: 6px; }
  .cluster-head { display: flex; justify-content: space-between; align-items: center; margin: 10px 0 4px; }
  .cluster-name { font-size: 12px; font-weight: 700; color: ${C.primary}; }
  .cluster-avg { font-size: 11px; font-weight: 700; }
  .row { margin-bottom: 7px; page-break-inside: avoid; }
  .row-head { display: flex; justify-content: space-between; align-items: center; }
  .row-name { font-size: 10px; font-weight: 700; color: ${C.text}; }
  .row-score { font-size: 10px; color: ${C.textLight}; }
  .row-def { font-size: 8.5px; color: ${C.textLight}; margin-top: 1px; }
  .bar-track { height: 5px; background: #eef0f3; border-radius: 3px; margin-top: 3px; display: flex; }
  .bar-fill { height: 5px; border-radius: 3px; background: ${C.accent}; }
  .row-narr { font-size: 8.5px; color: ${C.text}; margin-top: 2px; }
  .row-tip { font-size: 8.5px; color: ${C.primary}; margin-top: 2px; }
  .row-overuse { font-size: 8.5px; color: ${C.emerald}; margin-top: 2px; }
  .caption { margin-top: 8px; border: 1px solid ${C.border}; border-radius: 5px; background: #fafbfc; padding: 9px; font-size: 9px; color: ${C.textLight}; }
  .method-note { margin-top: 8px; font-size: 8.5px; color: ${C.textLight}; }
  /* Repeats on every printed page in Chromium print (position:fixed), shaped
     with the page's Arabic font - mirrors the EN per-page confidential footer. */
  .page-footer { position: fixed; bottom: 8mm; left: 12mm; right: 12mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid ${C.border}; padding-top: 5px; font-size: 7.5px; color: ${C.textLight}; }
</style>
</head>
<body>
  <div class="page-footer">
    <span>معهد فرجينيا للتمويل والإدارة - سري</span>
    <span>أُنشئ بتاريخ ${num(data.generatedAt)}</span>
  </div>
  ${parts.join("\n")}
</body>
</html>`;
}
