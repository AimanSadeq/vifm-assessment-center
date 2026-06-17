// Renders the ARC Methodology Brief markdown (docs/ARA-Methodology-Brief.md)
// into a print-ready, VIFM-branded HTML page for PDF generation. Pure +
// dependency-free: the route reads the markdown file and passes it in, so the
// doc stays the single source of truth (no embedded copy to drift).

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline formatting on already-escaped text: `code`, **bold**, *italic*. */
function inlineMd(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}

/** Minimal markdown -> HTML covering what the methodology brief uses:
 *  headings, hr, ordered/unordered lists, blockquotes, paragraphs, inline. */
export function methodologyMdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let i = 0;

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inlineMd(para.join(" "))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") { flushPara(); i++; continue; }
    if (trimmed === "---") { flushPara(); out.push("<hr/>"); i++; continue; }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        items.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineMd(items.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map((it) => `<li>${inlineMd(it)}</li>`).join("")}</ol>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().replace(/^-\s+/, ""));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${inlineMd(it)}</li>`).join("")}</ul>`);
      continue;
    }

    para.push(trimmed);
    i++;
  }
  flushPara();
  return out.join("\n");
}

/** Full standalone HTML document (A4 print CSS + VIFM branding). */
export function methodologyBriefHtml(md: string): string {
  const body = methodologyMdToHtml(md);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Open Sans", Arial, Helvetica, sans-serif;
    color: #111232; font-size: 11pt; line-height: 1.55; margin: 0;
  }
  .brandbar { border-bottom: 3px solid #5391D5; padding-bottom: 10px; margin-bottom: 22px; }
  .brandbar .eyebrow { color: #5391D5; font-size: 9pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .brandbar .org { color: #010131; font-size: 10pt; font-weight: 600; margin-top: 2px; }
  h1 { color: #010131; font-size: 19pt; margin: 0 0 4px; }
  h2 { color: #010131; font-size: 14pt; margin: 22px 0 8px; padding-top: 6px; border-top: 1px solid #e5e7eb; }
  h3 { color: #121140; font-size: 12pt; margin: 16px 0 4px; }
  h4 { color: #5391D5; font-size: 10.5pt; margin: 12px 0 2px; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0 10px; padding-left: 20px; }
  li { margin: 3px 0; }
  code { background: #f1f5f9; border-radius: 3px; padding: 1px 4px; font-family: "Courier New", monospace; font-size: 9.5pt; }
  strong { color: #010131; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0; }
  blockquote { margin: 12px 0; padding: 10px 14px; background: #f8fafc; border-left: 3px solid #5391D5; border-radius: 0 6px 6px 0; }
  h2, h3, h4 { page-break-after: avoid; }
  ul, ol, blockquote { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="brandbar">
    <div class="eyebrow">VIFM AI Readiness Compass®</div>
    <div class="org">Virginia Institute of Finance and Management</div>
  </div>
  ${body}
</body>
</html>`;
}
