/**
 * Arabic / RTL HTML renderer for the Fluent CEFR placement certificate.
 *
 * Pairs with React-PDF for English in the same route:
 *
 *   ar  → renderFluentCertificateHtmlAr → Puppeteer page.setContent → PDF
 *   en  → existing FluentCertificate React-PDF component
 *
 * React-PDF cannot shape Arabic glyphs (no harfbuzz / no font fallback),
 * which is why the EN path stays on it and the AR path goes via Chromium -
 * Chrome's text engine has full bidi + Arabic shaping out of the box, so
 * all we need is well-formed RTL HTML with a real Arabic font loaded.
 *
 * Layout mirrors the EN certificate (A4 landscape, single page) so both
 * versions feel like the same document: brand line, title + subtitle,
 * "this is to certify that" + name, the CEFR level disc, per-skill cells,
 * date + signature meta row, disclaimer, verification ID.
 *
 * CEFR level codes (A1/A2/B1/B2/C1/C2), the "CEFR" literal, and the "VIFM"
 * brand mark are kept verbatim; everything else is Modern Standard Arabic.
 *
 * ⚠️  Like the other Arabic report renderers in this folder, the Arabic
 * copy here is a placeholder pending native review before public-facing
 * distribution (see CLAUDE.md "Important Notes").
 */

import { AR_FONT_HREF, escapeHtml } from "./html-to-pdf";

/** VIFM brand palette (from CLAUDE.md), matched to the EN certificate. */
const C = {
  navy: "#010131",
  accent: "#5391D5",
  ink: "#111232",
  light: "#5b6577",
  border: "#dbe3ec",
  muted: "#9aa5b5",
};

export type FluentCertificateArData = {
  id: string;
  name: string;
  date: string; // already formatted (Arabic locale)
  overall_cefr: string;
  level_label: string; // Arabic CEFR band label, e.g. "متوسط"
  range?: string | null; // indicative confidence band, e.g. "B1–B2"
  skills: Array<{ label: string; cefr: string }>; // label already in Arabic
};

/**
 * Produce a complete HTML document string for the Arabic certificate.
 * Pass into Puppeteer's page.setContent({ waitUntil: 'networkidle0' }) via
 * renderHtmlToPdfBuffer(html, { landscape: true }).
 */
export function renderFluentCertificateHtmlAr(data: FluentCertificateArData): string {
  const skillCells = data.skills
    .map(
      (sk) =>
        `<div class="skill"><span class="skill-label">${escapeHtml(sk.label)}</span>` +
        `<span class="skill-cefr">${escapeHtml(sk.cefr)}</span></div>`
    )
    .join("");

  const levelLabel = data.level_label
    ? ` - ${escapeHtml(data.level_label)}`
    : "";
  const rangeLine = data.range
    ? `<div class="range-note">النطاق التقديري: ${escapeHtml(data.range)}</div>`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>شهادة تحديد مستوى اللغة الإنجليزية · ${escapeHtml(data.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${AR_FONT_HREF}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, serif;
      direction: rtl;
      color: ${C.ink};
      background: #fff;
    }
    @page { size: A4 landscape; margin: 14mm; }

    .frame {
      border: 3px double ${C.accent};
      border-radius: 10px;
      padding: 30px 44px;
      text-align: center;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .brand {
      font-size: 13px;
      letter-spacing: 0.1em;
      color: ${C.accent};
      font-weight: 700;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      color: ${C.navy};
      margin: 12px 0 4px;
    }
    .subtitle { font-size: 13px; color: ${C.light}; margin: 0 0 24px; }
    .awarded {
      font-size: 13px;
      color: ${C.light};
      letter-spacing: 0.04em;
    }
    .name {
      font-size: 32px;
      font-weight: 700;
      color: ${C.navy};
      margin: 6px 0 22px;
      border-bottom: 2px solid #eef2f7;
      display: inline-block;
      padding: 0 24px 10px;
    }
    .level-wrap { margin: 4px 0 6px; }
    .level {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${C.navy}, ${C.accent});
      color: #fff;
    }
    .level .lv { font-size: 50px; font-weight: 700; line-height: 1; }
    .level .lb { font-size: 11px; letter-spacing: 0.06em; margin-top: 6px; opacity: 0.92; }
    .level-desc { font-size: 14px; color: ${C.light}; margin: 12px 0 4px; }
    .range-note { font-size: 12px; color: ${C.muted}; margin: 0 0 22px; }
    .level-desc-last { margin-bottom: 26px; }
    .skills {
      display: flex;
      gap: 14px;
      justify-content: center;
      flex-wrap: wrap;
      margin: 0 0 26px;
    }
    .skill {
      min-width: 120px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
    }
    .skill-label {
      display: block;
      font-size: 12px;
      letter-spacing: 0.04em;
      color: ${C.light};
    }
    .skill-cefr {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: ${C.navy};
      margin-top: 4px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      width: 100%;
      max-width: 620px;
      margin-top: 18px;
      font-size: 12px;
      color: ${C.light};
    }
    .meta .sig { text-align: center; }
    .meta .sig .line {
      width: 200px;
      border-top: 1px solid ${C.muted};
      margin-bottom: 6px;
    }
    .meta strong { color: ${C.ink}; }
    .disclaimer {
      margin-top: 22px;
      font-size: 10.5px;
      color: #8a93a3;
      line-height: 1.6;
      max-width: 720px;
    }
    .verify {
      margin-top: 8px;
      font-family: Consolas, monospace;
      font-size: 10px;
      color: ${C.muted};
      direction: ltr;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="brand">معهد فرجينيا للتمويل والإدارة · VIFM</div>
    <div class="title">شهادة تحديد مستوى اللغة الإنجليزية</div>
    <p class="subtitle">
      تحديد مستوى تقديري وفق الإطار الأوروبي المرجعي للغات (CEFR) · القراءة · الاستماع · الكتابة · التحدّث
    </p>

    <div class="awarded">تشهد هذه الوثيقة بأن</div>
    <div class="name">${escapeHtml(data.name)}</div>

    <div class="level-wrap">
      <div class="level"><span class="lv">${escapeHtml(data.overall_cefr)}</span><span class="lb">CEFR</span></div>
    </div>
    <div class="level-desc${rangeLine ? "" : " level-desc-last"}">المستوى التقديري <strong>${escapeHtml(data.overall_cefr)}</strong>${levelLabel}</div>
    ${rangeLine}

    <div class="skills">${skillCells}</div>

    <div class="meta">
      <div><div>تاريخ التقييم</div><strong>${escapeHtml(data.date)}</strong></div>
      <div class="sig"><div class="line"></div>مركز التقييم في VIFM</div>
    </div>

    <p class="disclaimer">
      تعكس هذه الشهادة تحديد مستوى <strong>تقديري</strong> مُعَدّ بمساعدة الذكاء الاصطناعي ومتوافق مع الإطار الأوروبي المرجعي للغات (CEFR)، أُنتج عبر VIFM Fluent®. وهي مخصّصة لأغراض تحديد المستوى والتطوير، <strong>وليست</strong> مؤهلاً لغوياً معتمداً عالي المخاطر.${data.range ? ` النطاق التقديري وفق CEFR: ${escapeHtml(data.range)}.` : ""}
    </p>
    <p class="verify">المرجع: ${escapeHtml(data.id)}</p>
  </div>
</body>
</html>`;
}
