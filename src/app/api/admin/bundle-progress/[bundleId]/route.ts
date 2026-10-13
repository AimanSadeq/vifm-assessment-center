import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadBundleService } from "@/lib/bespoke/services";
import { loadBundleSettings, formatCompleteBy } from "@/lib/bespoke/bundle-settings";
import { loadRoster } from "@/lib/bespoke/roster";
import {
  loadBundleProgress, bundleStageFlags, fmtKsa, daysSince,
  PERSON_STATUS_LABEL, FOLLOW_UP_LABEL, SECTION_LABEL, type PersonStatus,
} from "@/lib/bespoke/progress";
import { buildXlsx } from "@/lib/xlsx/write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status-tracking export for one bundle (Ali's recommendation, 13 Oct 2026):
 * every person, their status, section progress, last activity and follow-up.
 * Under /api/admin/ (never /api/bundle/, which middleware leaves open for the
 * candidate flow) and admin-only: it carries every person's name and email.
 */
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(_req: Request, { params }: { params: { bundleId: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
  if (!UUID_RE.test(params.bundleId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bundle = await loadBundleService(params.bundleId);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [settings, roster] = await Promise.all([loadBundleSettings(bundle.id), loadRoster(bundle.id)]);
  const stages = bundleStageFlags(bundle.service_keys, settings);
  const people = await loadBundleProgress(bundle.id, roster, settings, stages);

  const header = [
    "Name", "Email", "Employee ID", "Grade", "Position", "Business unit", "Tester", "On approved list",
    "Status", "Signed in", "Consent given",
    ...(stages.sjt ? ["Scenarios answered", "Scenarios total", "Scenarios"] : []),
    ...(stages.logica ? ["Reasoning"] : []),
    ...(stages.persona ? ["Persona"] : []),
    "Last activity", "Days since last activity", "Completed", "Scored", "Times contacted", "Last contacted", "Needs follow-up",
  ];
  const rows = people.map((p) => [
    p.name, p.email, p.employeeId, p.grade, p.position, p.businessUnit, p.isTester ? "Yes" : "", p.onRoster ? "Yes" : "No",
    PERSON_STATUS_LABEL[p.status], fmtKsa(p.startedAt), fmtKsa(p.consentAt),
    ...(stages.sjt ? [p.sjt?.answered ?? 0, p.sjt?.total || null, SECTION_LABEL[p.sjt?.state ?? "not_started"]] : []),
    ...(stages.logica ? [SECTION_LABEL[p.logica ?? "not_started"]] : []),
    ...(stages.persona ? [SECTION_LABEL[p.persona ?? "not_started"]] : []),
    fmtKsa(p.lastActivityAt), daysSince(p.lastActivityAt), fmtKsa(p.completedAt), fmtKsa(p.scoredAt),
    p.contacts, fmtKsa(p.lastContactAt), p.followUp ? FOLLOW_UP_LABEL[p.followUp] : "",
  ]);

  const counted = people.filter((p) => !p.isTester);
  const count = (s: PersonStatus) => counted.filter((p) => p.status === s).length;
  const summary = [
    ["Assessment", bundle.name_en],
    ["Exported", fmtKsa(new Date().toISOString()) + " (KSA time)"],
    ["Complete by", formatCompleteBy(settings.completeBy) ?? "Not set"],
    ["State", settings.held ? "On hold" : "Open"],
    ["People (excluding testers)", counted.length],
    ...(["not_started", "signed_in", "in_progress", "completed", "scored"] as PersonStatus[]).map((s) => [PERSON_STATUS_LABEL[s], count(s)]),
    ["Needs follow-up", counted.filter((p) => p.followUp).length],
    ["Testers", people.length - counted.length],
  ];

  const buffer = await buildXlsx([
    { name: "Progress", header, rows },
    { name: "Summary", header: ["Item", "Value"], rows: summary, widths: [30, 50] },
  ]);
  const safe = (bundle.name_en || "Assessment").replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_") || "Assessment";
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}_progress_${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
