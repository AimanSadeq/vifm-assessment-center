/**
 * The engagement checklist as a printable page, for a signing meeting or a
 * business-development review away from the platform.
 */

import { OWNER_LABEL, type ChecklistStatus } from "@/lib/checklists/types";
import type { ChecklistSubject } from "@/lib/checklists/load";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmt = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

export function buildChecklistHtml(subject: ChecklistSubject, status: ChecklistStatus, serviceLabel: string, generatedAt: string): string {
  const pct = status.total ? Math.round((status.done / status.total) * 100) : 0;
  const phases = status.phases.map((p) => `
    <h2>${esc(p.label)} <span class="count">${p.done} of ${p.total}</span></h2>
    <table><thead><tr><th class="box"></th><th>Item</th><th>Owner</th><th>Status</th></tr></thead><tbody>
    ${p.items.map((it) => `<tr class="${it.done ? "done" : ""}">
      <td class="box">${it.done ? "&#9746;" : "&#9744;"}</td>
      <td>${esc(it.label)}${it.hint && !it.detail ? `<div class="hint">${esc(it.hint)}</div>` : ""}</td>
      <td>${esc(OWNER_LABEL[it.owner])}</td>
      <td>${it.source === "auto" ? `<span class="rec">record</span> ${esc(it.detail ?? "")}` : it.source === "manual" ? `Ticked${it.doneBy ? ` by ${esc(it.doneBy)}` : ""}${it.doneAt ? ` on ${esc(fmt(it.doneAt))}` : ""}${it.note ? `<div class="hint">${esc(it.note)}</div>` : ""}` : `<span class="open">Open</span>${it.detail ? ` ${esc(it.detail)}` : ""}${it.note ? `<div class="hint">${esc(it.note)}</div>` : ""}`}</td>
    </tr>`).join("")}
    </tbody></table>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap"/>
<title>Checklist - ${esc(subject.name)}</title>
<style>
  @page { size: A4; margin: 14mm 15mm; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111232; font-size: 9.5pt; line-height: 1.4; }
  .eyebrow { color: #5391D5; font-size: 8.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin: 0; }
  h1 { font-size: 17pt; color: #010131; margin: 4px 0 2px; }
  .sub { color: #5b6480; margin: 0 0 10px; }
  h2 { font-size: 11pt; color: #010131; margin: 12px 0 4px; border-bottom: 1px solid #d7dce8; padding-bottom: 2px; break-after: avoid; }
  .count { color: #8a91a8; font-size: 8.5pt; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e6e9f2; padding: 3px 6px; text-align: left; vertical-align: top; }
  th { color: #5b6480; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; }
  td.box, th.box { width: 16px; font-size: 12pt; padding-left: 2px; }
  tr.done td { color: #5b6480; }
  .hint { color: #8a91a8; font-size: 8pt; }
  .rec { background: #e6f4ea; color: #1b5e20; padding: 0 4px; border-radius: 3px; font-size: 8pt; }
  .open { background: #fff8e6; color: #9a6b00; padding: 0 4px; border-radius: 3px; font-size: 8pt; }
  .bar { height: 6px; background: #e6e9f2; border-radius: 3px; margin: 4px 0 8px; } .bar div { height: 100%; background: #5391D5; border-radius: 3px; }
  footer { margin-top: 12px; border-top: 1px solid #e6e9f2; padding-top: 5px; color: #8a91a8; font-size: 8pt; }
</style></head>
<body>
  <p class="eyebrow">${esc(serviceLabel)} · engagement checklist</p>
  <h1>${esc(subject.name)}</h1>
  <p class="sub">${[subject.organisationName, subject.status].filter(Boolean).map(esc).join(" &middot; ")} &middot; ${status.done} of ${status.total} items done (${pct}%)</p>
  <div class="bar"><div style="width:${pct}%"></div></div>
  ${phases}
  <footer>Virginia Institute of Finance and Management &middot; Generated ${esc(generatedAt)} from Caliber. "record" items are read from the platform at generation; the others were ticked by the person named.</footer>
</body></html>`;
}
