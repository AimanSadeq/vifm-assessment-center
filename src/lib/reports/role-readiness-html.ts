// Role Readiness combined report - self-contained HTML for Puppeteer (A4).
// Inline SVG icons + CSS only (no icon fonts, no raster images). One report:
// per-side scores, per-competency + per-area breakdown vs target, ready/not-ready
// verdict, and the development plan.

import type { RrReportData } from "@/lib/role-readiness/report-data";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Inline SVGs (no icon fonts / raster).
const CHECK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const CROSS = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#d97706" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function metBadge(passed: boolean | null): string {
  if (passed === true) return `<span class="badge met">${CHECK} Met</span>`;
  if (passed === false) return `<span class="badge below">${CROSS} Below</span>`;
  return `<span class="badge na">Not assessed</span>`;
}

export function renderRoleReadinessHtml(data: RrReportData): string {
  const ready = data.verdict === "ready";
  const verdictColor = ready ? "#059669" : data.verdict === "not_ready" ? "#d97706" : "#64748b";
  const verdictText = ready ? "READY" : data.verdict === "not_ready" ? "NOT READY" : "INCOMPLETE";

  const compRows = data.persona.competencies
    .map(
      (c) => `<tr>
        <td>${esc(c.name)}</td>
        <td class="num">${esc(c.target_level)}</td>
        <td class="num">${c.self_score == null ? "-" : esc(c.self_score)}</td>
        <td class="num">${c.attainment_pct == null ? "-" : esc(c.attainment_pct) + "%"}</td>
        <td>${metBadge(c.assessed ? !c.below_target : null)}</td>
      </tr>`,
    )
    .join("");

  const areaRows = data.technical.areas
    .map(
      (a) => `<tr>
        <td>${esc(a.name)}</td>
        <td class="num">${esc(a.target_pct)}%</td>
        <td class="num">${a.score_pct == null ? "-" : esc(a.score_pct) + "%"}</td>
        <td>${metBadge(a.assessed ? !a.below_target : null)}</td>
      </tr>`,
    )
    .join("");

  const devComps = data.developmentPlan.competencies
    .map((c) => `<li><span class="dev-name">${esc(c.name)}</span> - ${esc(c.suggestionEn)}</li>`)
    .join("");
  const devAreas = data.developmentPlan.areas
    .map((a) => `<li><span class="dev-name">${esc(a.name)}</span> - ${esc(a.suggestionEn)}</li>`)
    .join("");
  const hasDev = devComps.length > 0 || devAreas.length > 0;

  const sidePct = (p: number | null) => (p == null ? "-" : `${p}%`);

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111232; margin: 0; padding: 32px 36px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0; color: #010131; }
  .muted { color: #64748b; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #010131; padding-bottom:12px; }
  .verdict { text-align:center; border:2px solid ${verdictColor}; border-radius:10px; padding:8px 16px; }
  .verdict .v { font-size:18px; font-weight:700; color:${verdictColor}; letter-spacing:1px; }
  .verdict .l { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#64748b; }
  .sides { display:flex; gap:16px; margin:18px 0; }
  .side { flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:14px; }
  .side .lbl { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; }
  .side .pct { font-size:28px; font-weight:700; color:#010131; }
  .side .thr { font-size:11px; }
  h2 { font-size:13px; color:#010131; margin:20px 0 8px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #eef2f7; font-size:11px; }
  th { background:#f8fafc; text-transform:uppercase; font-size:9px; letter-spacing:.5px; color:#64748b; }
  td.num, th.num { text-align:center; }
  .badge { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:600; padding:2px 6px; border-radius:10px; }
  .badge.met { background:#ecfdf5; color:#059669; }
  .badge.below { background:#fffbeb; color:#d97706; }
  .badge.na { background:#f1f5f9; color:#64748b; }
  .dev { border:1px solid #e2e8f0; border-left:4px solid #5391D5; border-radius:8px; padding:12px 16px; margin-top:8px; }
  .dev ul { margin:6px 0 0; padding-left:18px; }
  .dev li { margin:4px 0; }
  .dev-name { font-weight:600; }
  .footer { margin-top:24px; border-top:1px solid #e2e8f0; padding-top:10px; font-size:9px; color:#94a3b8; }
</style></head><body>
  <div class="hdr">
    <div>
      <h1>Role Readiness Report</h1>
      <div class="muted" style="margin-top:4px;">${esc(data.roleNameEn)}${data.roleNameAr ? " · " + esc(data.roleNameAr) : ""}</div>
      <div class="muted" style="margin-top:8px;font-size:11px;">
        <strong>${esc(data.candidateName)}</strong> · ${esc(data.candidateEmail)}${data.organizationName ? " · " + esc(data.organizationName) : ""}
      </div>
    </div>
    <div class="verdict"><div class="l">Overall</div><div class="v">${verdictText}</div></div>
  </div>

  <div class="sides">
    <div class="side">
      <div class="lbl">Behavioural (Persona)</div>
      <div class="pct">${sidePct(data.persona.scorePct)}</div>
      <div class="thr">${metBadge(data.persona.passed)} <span class="muted">target ${esc(data.persona.threshold)}%</span></div>
    </div>
    <div class="side">
      <div class="lbl">Technical</div>
      <div class="pct">${sidePct(data.technical.scorePct)}</div>
      <div class="thr">${metBadge(data.technical.passed)} <span class="muted">target ${esc(data.technical.threshold)}%</span></div>
    </div>
  </div>

  <h2>Behavioural competencies vs target</h2>
  <table><thead><tr><th>Competency</th><th class="num">Target</th><th class="num">Self</th><th class="num">Attainment</th><th>Result</th></tr></thead>
  <tbody>${compRows || `<tr><td colspan="5" class="muted">No competencies configured.</td></tr>`}</tbody></table>

  <h2>Technical areas vs target</h2>
  <table><thead><tr><th>Area</th><th class="num">Target</th><th class="num">Score</th><th>Result</th></tr></thead>
  <tbody>${areaRows || `<tr><td colspan="4" class="muted">No technical areas configured.</td></tr>`}</tbody></table>

  <h2>Development plan</h2>
  ${hasDev
    ? `<div class="dev"><ul>${devComps}${devAreas}</ul></div>`
    : `<div class="dev muted">No development areas - all assessed competencies and technical areas met target.</div>`}

  <div class="footer">
    Generated ${esc(data.generatedAt.toISOString().slice(0, 10))} · VIFM Role Readiness (Persona + Techno). A screening &amp; development signal; a person makes the final decision.
  </div>
</body></html>`;
}
