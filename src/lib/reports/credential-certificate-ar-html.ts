/**
 * Arabic / RTL HTML renderer for the VIFM credential certificate PDF.
 * Pairs with React-PDF for English in the same route:
 *
 *   ar  → renderCredentialCertificateHtmlAr → Puppeteer page.setContent → PDF
 *   en  → existing React-PDF CredentialCertificate component
 *
 * React-PDF cannot shape Arabic glyphs (no harfbuzz / no font fallback),
 * which is why the EN path stays on it and the AR path goes via a
 * Chromium render - Chrome's text engine has full bidi + Arabic shaping
 * out of the box, so all we need is well-formed RTL HTML with a real
 * Arabic font loaded.
 *
 * Layout mirrors the React-PDF EN certificate (A4 landscape, accent
 * border frame, centred brand → title → type label → name → cred title →
 * subtitle → score → issued/valid-until + signature → disclaimer →
 * verify URL) so the two language versions feel like the same document.
 *
 * ⚠️  Arabic copy here is Modern Standard Arabic with a GCC-business
 * register. As with the rest of the app's Arabic content, it should
 * get a native review before public-facing distribution.
 */

import { AR_FONT_HREF, escapeHtml } from "@/lib/reports/html-to-pdf";

/** VIFM brand palette (from CLAUDE.md / the EN certificate). */
const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  light: "#5b6577",
  border: "#dbe3ec",
  muted: "#9aa5b5",
};

/**
 * Arabic certificate data. Reuses the EN CredentialCertificateData fields,
 * but the caller passes Arabic-localized strings (title / subtitle / type
 * label / pre-formatted dates).
 */
export type CredentialCertificateArData = {
  verificationCode: string;
  name: string;
  typeLabel: string; // Arabic, e.g. "إتمام دورة"
  titleAr: string; // Arabic credential title (caller falls back to EN if null)
  subtitleAr?: string | null;
  issuedAt: string; // pre-formatted (Arabic locale)
  expiresAt?: string | null; // pre-formatted (Arabic locale)
  scorePct?: number | null;
  verifyUrl: string; // https://caliber.viftraining.com/verify/[code]
};

/**
 * Produces a complete HTML document string. Pass into Puppeteer's
 * renderHtmlToPdfBuffer(html, { landscape: true }).
 */
export function renderCredentialCertificateHtmlAr(
  data: CredentialCertificateArData
): string {
  const scoreHtml =
    data.scorePct != null
      ? `<p class="score">الدرجة: ${escapeHtml(String(data.scorePct))}٪</p>`
      : "";

  const validUntilHtml = data.expiresAt
    ? `
        <div class="meta-cell">
          <span class="meta-label">صالح حتى</span>
          <span class="meta-val">${escapeHtml(data.expiresAt)}</span>
        </div>`
    : "";

  const subtitleHtml = data.subtitleAr
    ? `<p class="subtitle">${escapeHtml(data.subtitleAr)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>شهادة · ${escapeHtml(data.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${AR_FONT_HREF}" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Noto Naskh Arabic", serif;
      direction: rtl;
      color: ${C.text};
      background: #fff;
    }
    @page { size: A4 landscape; margin: 0; }

    .page {
      width: 297mm;
      height: 209mm;
      padding: 12mm;
    }
    .frame {
      border: 2px solid ${C.accent};
      border-radius: 10px;
      height: 100%;
      padding: 14mm 16mm 12mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .brand {
      font-size: 11pt;
      color: ${C.accent};
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    .title {
      font-size: 30pt;
      font-weight: 700;
      color: ${C.primary};
      margin: 10px 0 0;
    }
    .type-label {
      font-size: 11pt;
      color: ${C.light};
      letter-spacing: 0.04em;
      margin: 8px 0 22px;
    }
    .awarded {
      font-size: 11pt;
      color: ${C.light};
      letter-spacing: 0.02em;
      margin: 6px 0 0;
    }
    .name {
      font-size: 30pt;
      font-weight: 700;
      color: ${C.primary};
      margin: 6px 0 18px;
      padding: 0 22px 8px;
      border-bottom: 1px solid ${C.border};
    }
    .cred-title {
      font-size: 19pt;
      font-weight: 700;
      color: ${C.primary};
      margin: 2px 0 0;
      padding: 0 30px;
    }
    .subtitle {
      font-size: 12pt;
      color: ${C.light};
      margin: 8px 0 0;
      padding: 0 60px;
      line-height: 1.5;
    }
    .score {
      font-size: 14pt;
      font-weight: 700;
      color: ${C.accent};
      margin: 10px 0 0;
    }

    .meta-row {
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      align-items: flex-end;
      width: 100%;
      margin-top: auto;
      padding: 0 18px;
    }
    .meta-cell { text-align: center; }
    .meta-label { display: block; font-size: 9pt; color: ${C.light}; }
    .meta-val {
      display: block;
      font-size: 12pt;
      font-weight: 700;
      color: ${C.text};
      margin-top: 3px;
    }
    .sig { text-align: center; }
    .sig-line {
      width: 190px;
      border-top: 1px solid ${C.muted};
      margin: 0 auto 5px;
    }

    .disclaimer {
      font-size: 9pt;
      color: ${C.muted};
      margin: 20px 0 0;
      padding: 0 28px;
      line-height: 1.5;
    }
    .verify {
      font-size: 9.5pt;
      color: ${C.muted};
      margin: 9px 0 0;
      direction: ltr;
      font-family: "Courier New", monospace;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="frame">
      <p class="brand">معهد فرجينيا للتمويل والإدارة</p>
      <h1 class="title">شهادة</h1>
      <p class="type-label">${escapeHtml(data.typeLabel)}</p>

      <p class="awarded">تشهد هذه الوثيقة بأن</p>
      <p class="name">${escapeHtml(data.name)}</p>

      <p class="cred-title">${escapeHtml(data.titleAr)}</p>
      ${subtitleHtml}
      ${scoreHtml}

      <div class="meta-row">
        <div class="meta-cell">
          <span class="meta-label">تاريخ الإصدار</span>
          <span class="meta-val">${escapeHtml(data.issuedAt)}</span>
        </div>
        ${validUntilHtml}
        <div class="sig">
          <div class="sig-line"></div>
          <span class="meta-label">معهد فرجينيا للتمويل والإدارة</span>
        </div>
      </div>

      <p class="disclaimer">صدرت هذه الشهادة عن معهد فرجينيا للتمويل والإدارة. يمكنك التحقق من صحتها عبر العنوان أدناه.</p>
      <p class="verify">تحقّق عبر: ${escapeHtml(data.verifyUrl)}</p>
    </div>
  </div>
</body>
</html>`;
}
