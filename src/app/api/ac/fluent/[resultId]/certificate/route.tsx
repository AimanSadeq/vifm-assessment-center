/**
 * Fluent - CEFR placement certificate.
 *
 * GET /api/ac/fluent/[resultId]/certificate            -> printable HTML
 * GET /api/ac/fluent/[resultId]/certificate?format=pdf -> downloadable PDF
 *
 * HTML is the default (view + browser "Save as PDF"); ?format=pdf returns
 * a true React-PDF document as an attachment. Reads via the service client
 * (results are anonymous, written by the scoring route). 404s cleanly if
 * the row or table is absent. Indicative placement - not a certified score.
 */

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { FluentCertificate, type FluentCertificateData } from "@/lib/reports/fluent-certificate";
import {
  renderFluentCertificateHtmlAr,
  type FluentCertificateArData,
} from "@/lib/reports/fluent-certificate-ar-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { getServerLocale } from "@/lib/i18n/server";
import { fluentServesLive } from "@/lib/bank-readiness/serves-live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CEFR_LABEL: Record<string, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper-intermediate",
  C1: "Advanced",
  C2: "Proficient / Mastery",
};

// Arabic CEFR band labels - parallel to CEFR_LABEL. Level codes stay
// verbatim (A1…C2); only the descriptive band is translated.
const CEFR_LABEL_AR: Record<string, string> = {
  A1: "مبتدئ",
  A2: "أساسي",
  B1: "متوسط",
  B2: "فوق المتوسط",
  C1: "متقدّم",
  C2: "إتقان / تمكّن",
};

// Arabic skill labels, keyed by the English label used internally.
const SKILL_LABEL_AR: Record<string, string> = {
  Reading: "القراءة",
  Listening: "الاستماع",
  Writing: "الكتابة",
  Speaking: "التحدّث",
};

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// React-PDF (Helvetica) cannot shape Arabic; an Arabic name would print as tofu.
// Detect it so the PDF certificate routes to the Arabic (Puppeteer) renderer,
// which shapes the name correctly - even when the UI locale is English.
const hasArabic = (s: string): boolean => /[؀-ۿݐ-ݿ]/.test(s);

function notFound(): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Certificate not found</title>` +
      `<body style="font-family:system-ui;padding:3rem;color:#010131">` +
      `<h1>Certificate not available</h1>` +
      `<p>This result could not be found. It may have expired or not been saved.</p></body>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

type Row = {
  id: string;
  created_at: string;
  taker_name: string | null;
  overall_cefr: string;
  reading_cefr: string | null;
  listening_cefr: string | null;
  listening_total: number;
  writing_cefr: string | null;
  speaking_attempted: boolean;
  speaking_cefr: string | null;
  organization_id: string | null;
  result: { reliability?: { low?: string; high?: string } } | null;
};

export async function GET(req: Request, { params }: { params: { resultId: string } }) {
  // XP-13: the certificate is staff-only. Takers never see their results; an
  // admin/consultant/assessor downloads or sends the report from the cohort view.
  // Additive (mirrors the report route): a client_manager may download a
  // certificate for THEIR OWN org's result - so the org-scoped cohort's certificate
  // link works instead of 403ing.
  let clientMgrOrgId: string | null = null;
  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    const caller = await getCurrentCaller();
    if (caller?.role === "client_manager") {
      clientMgrOrgId = await getClientOrgId();
      if (!clientMgrOrgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let row: Row | null = null;
  try {
    const sb = createServiceClient();
    const BASE =
      "id, created_at, taker_name, overall_cefr, reading_cefr, listening_cefr, listening_total, writing_cefr, speaking_attempted, speaking_cefr, result";
    // Prefer the org-scoped select, but degrade if organization_id isn't migrated
    // yet (else the whole certificate 404s on a partial env). A client_manager
    // still can't reach an un-orged result: with organization_id absent the check
    // below sees `undefined !== orgId` and 403s - fail-closed, never fail-open.
    let data: unknown = null;
    const withOrg = await sb
      .from("eng_fluent_results")
      .select(`${BASE}, organization_id`)
      .eq("id", params.resultId)
      .single();
    if (withOrg.error) {
      const fallback = await sb.from("eng_fluent_results").select(BASE).eq("id", params.resultId).single();
      data = fallback.data;
    } else {
      data = withOrg.data;
    }
    row = (data as Row) ?? null;
  } catch {
    row = null;
  }
  if (!row) return notFound();
  // A client_manager may only download their own org's certificate.
  if (clientMgrOrgId && row.organization_id !== clientMgrOrgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Option 2 gate: while the receptive bank still mints items live-AI at sitting
  // time (not yet SME-promoted), flag the placement content as pending review.
  const provisional = await fluentServesLive();
  const provisionalNote = provisional
    ? " The reading and listening items in this sitting were generated live and have not yet been reviewed by a subject-matter expert."
    : "";

  const name = row.taker_name?.trim() || "Candidate";
  const date = new Date(row.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const level = row.overall_cefr;
  const levelLabel = CEFR_LABEL[row.overall_cefr] ?? "";
  const skills: Array<{ label: string; cefr: string }> = [
    { label: "Reading", cefr: row.reading_cefr ?? "-" },
    ...(row.listening_total > 0 ? [{ label: "Listening", cefr: row.listening_cefr ?? "-" }] : []),
    { label: "Writing", cefr: row.writing_cefr ?? "-" },
    ...(row.speaking_attempted ? [{ label: "Speaking", cefr: row.speaking_cefr ?? "-" }] : []),
  ];
  const band = row.result?.reliability;
  const rangeText =
    band?.low && band?.high ? (band.low === band.high ? band.low : `${band.low}–${band.high}`) : null;

  // Language for the PDF: explicit ?lang= wins, else the vifm-locale
  // cookie. Anything other than "ar" falls back to English.
  const url = new URL(req.url);
  const lang =
    ((url.searchParams.get("lang") ?? (await getServerLocale())) === "ar"
      ? "ar"
      : "en");

  // ── PDF branch ──
  if (url.searchParams.get("format") === "pdf") {
    const safeName = name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "candidate";

    // ── Arabic path: Puppeteer renders RTL HTML so Chromium can shape
    //    the Arabic glyphs React-PDF cannot. Same data shape; layout
    //    mirrors the EN landscape certificate. Also used when the taker's
    //    NAME is Arabic (even on an EN request) so it never prints as tofu. ──
    if (lang === "ar" || hasArabic(name)) {
      const arDate = new Date(row.created_at).toLocaleDateString("ar-AE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const arData: FluentCertificateArData = {
        id: row.id,
        name,
        date: arDate,
        overall_cefr: level,
        level_label: CEFR_LABEL_AR[row.overall_cefr] ?? "",
        range: rangeText,
        skills: skills.map((sk) => ({
          label: SKILL_LABEL_AR[sk.label] ?? sk.label,
          cefr: sk.cefr,
        })),
      };
      const html = renderFluentCertificateHtmlAr(arData);
      const buffer = await renderHtmlToPdfBuffer(html, { landscape: true });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="VIFM-Fluent-Certificate-${safeName}-ar.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ── English path: existing React-PDF renderer. Unchanged. ──
    const data: FluentCertificateData = {
      id: row.id,
      name,
      date,
      overall_cefr: level,
      level_label: levelLabel,
      range: rangeText,
      skills,
    };
    const buffer = await renderToBuffer(<FluentCertificate data={data} />);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="VIFM-Fluent-Certificate-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── HTML branch (default, printable) ──
  const skillCells = skills
    .map(
      (sk) =>
        `<div class="skill"><span class="skill-label">${esc(sk.label)}</span>` +
        `<span class="skill-cefr">${esc(sk.cefr)}</span></div>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Fluent® - Certificate of Placement</title>
<style>
  :root { --navy:#010131; --accent:#5391D5; --ink:#111232; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Open Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#eef2f7; color:var(--ink); }
  .toolbar { text-align:center; padding:16px; }
  .toolbar a, .toolbar button { display:inline-block; background:var(--navy); color:#fff; border:0; border-radius:8px; padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer; text-decoration:none; margin:0 4px; }
  .toolbar a.alt { background:var(--accent); }
  .toolbar button:hover, .toolbar a:hover { opacity:.92; }
  .sheet { width:1000px; max-width:94vw; margin:0 auto 40px; background:#fff; border:1px solid #dbe3ec; border-radius:14px; padding:56px 64px; box-shadow:0 8px 30px rgba(1,1,49,.08); }
  .frame { border:3px double var(--accent); border-radius:10px; padding:44px 48px; text-align:center; }
  .brand { font-size:13px; letter-spacing:.28em; text-transform:uppercase; color:var(--accent); font-weight:700; }
  .title { font-size:30px; font-weight:800; color:var(--navy); margin:14px 0 4px; }
  .subtitle { font-size:13px; color:#5b6577; margin:0 0 28px; }
  .awarded { font-size:13px; color:#5b6577; text-transform:uppercase; letter-spacing:.12em; }
  .name { font-size:34px; font-weight:800; color:var(--navy); margin:6px 0 26px; border-bottom:2px solid #eef2f7; display:inline-block; padding:0 24px 10px; }
  .level-wrap { margin:8px 0 6px; }
  .level { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; width:150px; height:150px; border-radius:50%; background:linear-gradient(135deg,var(--navy),var(--accent)); color:#fff; }
  .level .lv { font-size:54px; font-weight:800; line-height:1; }
  .level .lb { font-size:11px; letter-spacing:.08em; margin-top:6px; opacity:.92; }
  .level-desc { font-size:14px; color:#5b6577; margin:10px 0 30px; }
  .skills { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; margin:0 0 30px; }
  .skill { min-width:120px; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; }
  .skill-label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#5b6577; }
  .skill-cefr { display:block; font-size:24px; font-weight:800; color:var(--navy); margin-top:4px; }
  .meta { display:flex; justify-content:space-between; align-items:flex-end; margin-top:34px; font-size:12px; color:#5b6577; }
  .meta .sig { text-align:center; }
  .meta .sig .line { width:200px; border-top:1px solid #9aa5b5; margin-bottom:6px; }
  .disclaimer { margin-top:26px; font-size:10.5px; color:#8a93a3; line-height:1.5; }
  .verify { font-family: ui-monospace, monospace; font-size:10px; color:#9aa5b5; }
  @media print {
    body { background:#fff; }
    .toolbar { display:none; }
    .sheet { border:0; box-shadow:none; margin:0; width:auto; max-width:none; padding:0; }
    @page { size: A4 landscape; margin: 14mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Print</button>
    <a class="alt" href="?format=pdf">Download PDF</a>
  </div>
  <div class="sheet">
    <div class="frame">
      <div class="brand">Virginia Institute of Finance &amp; Management</div>
      <div class="title">Fluent® - Certificate of English Placement</div>
      <p class="subtitle">CEFR-aligned indicative placement · Reading · Listening · Writing · Speaking</p>

      <div class="awarded">This is to certify that</div>
      <div class="name">${esc(name)}</div>

      <div class="level-wrap">
        <div class="level"><span class="lv">${esc(level)}</span><span class="lb">CEFR</span></div>
      </div>
      <div class="level-desc">Indicative level <strong>${esc(level)}</strong>${levelLabel ? ` - ${esc(levelLabel)}` : ""}</div>

      <div class="skills">${skillCells}</div>

      <div class="meta">
        <div><div>Date of assessment</div><strong>${esc(date)}</strong></div>
        <div class="sig"><div class="line"></div>VIFM Assessment Center</div>
      </div>

      <p class="disclaimer">
        This certificate reflects an AI-assisted, CEFR-aligned <strong>indicative</strong> placement produced by Fluent.
        It is intended for placement and development purposes and is <strong>not</strong> a certified high-stakes language qualification.${rangeText ? ` Indicative CEFR range: ${esc(rangeText)}.` : ""}${provisionalNote}
      </p>
      <p class="verify">Result reference: ${esc(row.id)}</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
