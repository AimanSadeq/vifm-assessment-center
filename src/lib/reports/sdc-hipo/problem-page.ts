import { NextResponse } from "next/server";
import { escapeHtml } from "@/lib/reports/html-to-pdf";

/**
 * A refusal that a person will read. The SDC report links open in a new
 * browser tab, so a refusal has to be a short page rather than raw JSON. The
 * page carries no script (nothing for a content security policy to allow);
 * the reader closes the tab and goes back to the progress table.
 */
export function problemPage(message: string, status: number) {
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Report not available</title><style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f8fb;color:#1f2937}` +
    `main{max-width:520px;margin:12vh auto;padding:28px 32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px}` +
    `h1{font-size:18px;margin:0 0 10px;display:flex;align-items:center;gap:10px}p{margin:0 0 12px;line-height:1.5}.muted{color:#6b7280;font-size:13px}</style></head>` +
    `<body><main><h1><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Report not available</h1>` +
    `<p>${escapeHtml(message)}</p><p class="muted">Close this tab and use the progress table on the assessment page.</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
