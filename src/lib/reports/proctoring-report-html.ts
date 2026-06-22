/**
 * Proctoring & Integrity Report (HTML -> PDF via Puppeteer).
 *
 * The defensibility addendum for a camera-proctored sitting: consent record,
 * session metadata, the AI vision review summary + motion signal, and a snapshot
 * contact sheet. Deliberately a SEPARATE document from the assessment/placement
 * report - it carries face snapshots (sensitive PII), so it's the access-
 * controlled evidence record an admin shares on request, not baked into the
 * client-facing result. A review aid for a human; never an automatic pass/fail.
 *
 * Rendered with renderHtmlToPdfBuffer (networkidle0 waits for the signed-URL
 * snapshot images to load before capture). Node runtime only.
 */
import { escapeHtml } from "./html-to-pdf";
import type { ProctorSessionView, SnapshotFlags } from "@/lib/proctor/access";

const HIGH_MOTION = 25;

function fmt(ts: string | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeOnly(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type Chip = { label: string; tone: "rose" | "amber" };

function flagChips(flags: SnapshotFlags | null): Chip[] {
  const chips: Chip[] = [];
  if (typeof flags?.faces === "number") {
    if (flags.faces === 0) chips.push({ label: "no face", tone: "rose" });
    else if (flags.faces >= 2) chips.push({ label: `${flags.faces} faces`, tone: "rose" });
  }
  if (flags?.device_or_screen) chips.push({ label: "device", tone: "rose" });
  if (flags?.looking_away) chips.push({ label: "looking away", tone: "amber" });
  if (typeof flags?.motion === "number" && flags.motion >= HIGH_MOTION) {
    chips.push({ label: `motion ${flags.motion}`, tone: "amber" });
  }
  return chips;
}

export function proctoringReportHtml(view: ProctorSessionView): string {
  const { session, snapshots } = view;
  const review = session.ai_review;
  const durationMin = session.ended_at
    ? Math.max(0, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000))
    : null;

  const meta = (label: string, value: string) =>
    `<div class="meta"><div class="metaLabel">${escapeHtml(label)}</div><div class="metaValue">${escapeHtml(value)}</div></div>`;

  const consentBlock = session.consent_text
    ? `<div class="consent">
         <div class="consentTitle">Consent recorded ${session.consent_at ? `· ${escapeHtml(fmt(session.consent_at))}` : ""}</div>
         <div class="consentText">${escapeHtml(session.consent_text)}</div>
       </div>`
    : `<div class="consent muted">No explicit consent text was recorded for this session.</div>`;

  const stat = (label: string, n: number) =>
    `<div class="stat ${n > 0 ? "stathit" : ""}"><div class="statN">${n}</div><div class="statL">${escapeHtml(label)}</div></div>`;

  const reviewBlock = review
    ? `<div class="reviewline">${
        review.configured
          ? `AI vision review: <strong>${review.analyzed}</strong> of <strong>${review.total}</strong> frames analysed`
          : `AI vision review not configured - motion signal only`
      }${session.ai_reviewed_at ? ` · ${escapeHtml(fmt(session.ai_reviewed_at))}` : ""}</div>
       <div class="stats">
         ${stat("No face", review.no_face)}
         ${stat("Multiple faces", review.multiple_faces)}
         ${stat("Looking away", review.looking_away)}
         ${stat("Device / screen", review.device_or_screen)}
         ${stat("High motion", review.high_motion)}
       </div>`
    : `<div class="reviewline muted">No AI integrity review has been run on this session yet. The snapshots below are the captured evidence for human review.</div>`;

  const snapCells =
    snapshots.length === 0
      ? `<div class="muted">No snapshots were captured for this session.</div>`
      : snapshots
          .map((s) => {
            const chips = flagChips(s.flags);
            const flagged = chips.some((c) => c.tone === "rose");
            const img = s.signedUrl
              ? `<img src="${escapeHtml(s.signedUrl)}" alt="Snapshot ${s.sequence}" />`
              : `<div class="noimg">image unavailable</div>`;
            const chipHtml = chips
              .map((c) => `<span class="chip ${c.tone}">${escapeHtml(c.label)}</span>`)
              .join("");
            return `<div class="snap ${flagged ? "flagged" : ""}">
              ${img}
              <div class="snapmeta"><span>#${s.sequence} · ${escapeHtml(timeOnly(s.captured_at))}</span></div>
              ${chipHtml ? `<div class="snapchips">${chipHtml}</div>` : ""}
            </div>`;
          })
          .join("");

  const subject = session.subject_name || "Anonymous taker";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Open Sans", Arial, Helvetica, sans-serif; color: #111232; font-size: 11pt; line-height: 1.5; margin: 0; }
  .brandbar { border-bottom: 3px solid #5391D5; padding-bottom: 10px; margin-bottom: 16px; }
  .eyebrow { color: #5391D5; font-size: 9pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .org { color: #010131; font-size: 10pt; font-weight: 600; margin-top: 2px; }
  h1 { color: #010131; font-size: 18pt; margin: 4px 0 2px; }
  .sub { color: #5b6577; font-size: 10pt; }
  .badge { display: inline-block; margin-top: 6px; border: 1px solid #5391D5; background: rgba(83,145,213,.1); color: #3f73a8; font-size: 9pt; font-weight: 700; border-radius: 999px; padding: 2px 10px; }
  h2 { color: #010131; font-size: 12.5pt; margin: 18px 0 8px; padding-top: 6px; border-top: 1px solid #e5e7eb; }
  .metaGrid { display: flex; flex-wrap: wrap; gap: 10px 24px; }
  .meta { min-width: 120px; }
  .metaLabel { font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #8a93a3; }
  .metaValue { font-size: 10.5pt; color: #010131; }
  .consent { margin-top: 10px; border: 1px solid #6ee7b7; background: #ecfdf5; border-radius: 6px; padding: 10px 12px; }
  .consentTitle { font-weight: 700; color: #047857; font-size: 10pt; }
  .consentText { color: #065f46; font-size: 9.5pt; margin-top: 3px; }
  .reviewline { font-size: 10pt; margin-bottom: 8px; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .stat { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 12px; min-width: 84px; }
  .stat.stathit { border-color: #fda4af; background: #fff1f2; }
  .statN { font-size: 16pt; font-weight: 700; color: #010131; }
  .statL { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; color: #8a93a3; }
  .contact { display: flex; flex-wrap: wrap; gap: 8px; }
  .snap { width: 23%; border: 1px solid #dbe3ec; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .snap.flagged { border-color: #fda4af; }
  .snap img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; }
  .snap .noimg { display: flex; align-items: center; justify-content: center; height: 70px; background: #f1f5f9; color: #8a93a3; font-size: 8pt; }
  .snapmeta { font-size: 7.5pt; color: #5b6577; padding: 3px 5px; }
  .snapchips { padding: 0 5px 5px; display: flex; flex-wrap: wrap; gap: 3px; }
  .chip { font-size: 7pt; font-weight: 600; border-radius: 3px; padding: 1px 4px; }
  .chip.rose { background: #ffe4e6; color: #be123c; }
  .chip.amber { background: #fef3c7; color: #b45309; }
  .muted { color: #8a93a3; font-size: 9.5pt; }
  .disclaimer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 8.5pt; color: #5b6577; font-style: italic; }
</style>
</head>
<body>
  <div class="brandbar">
    <div class="eyebrow">VIFM · Proctoring &amp; Integrity Report</div>
    <div class="org">Virginia Institute of Finance and Management</div>
  </div>

  <h1>${escapeHtml(subject)}</h1>
  <div class="sub">${escapeHtml(session.subject_email || "")}${session.subject_email ? " · " : ""}${escapeHtml(session.context)} placement · ${escapeHtml(fmt(session.started_at))}</div>
  <div class="badge">Camera-proctored</div>

  <h2>Session</h2>
  <div class="metaGrid">
    ${meta("Started", fmt(session.started_at))}
    ${meta("Ended", fmt(session.ended_at))}
    ${meta("Duration", durationMin === null ? "-" : `${durationMin} min`)}
    ${meta("Snapshots", String(session.snapshot_count))}
    ${meta("Reference", session.ref_id || "-")}
    ${meta("Auto-delete after", fmt(session.expires_at))}
  </div>
  ${consentBlock}

  <h2>Integrity review</h2>
  ${reviewBlock}

  <h2>Snapshots (${snapshots.length})</h2>
  <div class="contact">${snapCells}</div>

  <div class="disclaimer">
    Camera proctoring captures periodic still snapshots (not continuous video) with the taker's consent. The flags
    above are an AI-assisted review aid for a human reviewer - they are advisory and never constitute an automatic
    pass/fail decision. Snapshot images are stored securely and automatically deleted after 90 days.
  </div>
</body>
</html>`;
}
