/**
 * Pre-Hire ATS export — requisition + ranked shortlist as JSON or CSV.
 *
 * GET /api/admin/prehire/[id]/export?format=json|csv
 *
 * SECURITY: this lives under /api/admin/ (NOT /api/prehire/, which middleware
 * auth-bypasses for the candidate token flow) and is gated with
 * requireRole(["admin"]). It exposes every candidate's PII + scores, so it must
 * never sit behind a public prefix. Data is read with the service client; the
 * composite is recomputed from stage results (single source of truth), never
 * read from a possibly-stale persisted column.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { computeComposite, rankByComposite, RECOMMENDATION_LABELS } from "@/lib/prehire/scoring";
import { logPrehireEvent } from "@/lib/prehire/audit";
import { PREHIRE_STAGE_LABELS } from "@/types/prehire";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";

export const dynamic = "force-dynamic";

type StageResult = {
  kind: PrehireStageKind;
  status: string;
  normalized_score: number | null;
  passed: boolean | null;
};
type CandidateRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  consent_at: string | null;
  invited_at: string | null;
  completed_at: string | null;
  prehire_stage_results: StageResult[];
};

const slug = (s: string) =>
  (s || "requisition").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "requisition";

// RFC-4180-ish CSV cell: quote when it contains comma, quote, or newline.
const csvCell = (v: string | number | null): string => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const svc = createServiceClient();

  const { data: requisition, error } = await svc
    .from("prehire_requisitions")
    .select("id, title, level, status, english_required, stage_config, organizations(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!requisition) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });

  const plan = (requisition.stage_config ?? []) as PrehireStagePlanEntry[];
  const orgName = (requisition.organizations as unknown as { name: string } | null)?.name ?? null;

  const { data: candData } = await svc
    .from("prehire_candidates")
    .select(
      "id, full_name, email, phone, status, consent_at, invited_at, completed_at, prehire_stage_results(kind, status, normalized_score, passed)"
    )
    .eq("requisition_id", params.id);

  const candidates = (candData ?? []) as unknown as CandidateRow[];
  const scored = candidates.map((c) => {
    const result = computeComposite(plan, c.prehire_stage_results ?? []);
    return { ...c, composite: result.composite, recommendation: result.recommendation, perStage: result.perStage };
  });
  const ranked = rankByComposite(scored);

  await logPrehireEvent({
    action: "export_taken",
    requisitionId: params.id,
    actorId: caller.isDev ? null : caller.uid,
    actorLabel: "admin",
    detail: { format, candidate_count: ranked.length },
  });

  const baseName = `vifm-prehire-${slug(requisition.title as string)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const header = [
      "Rank", "Candidate", "Email", "Phone", "Status",
      ...plan.map((s) => PREHIRE_STAGE_LABELS[s.kind]),
      "Composite", "Signal", "Consented at", "Invited at", "Completed at",
    ];
    const lines = ranked.map((c, i) => {
      const stageCells = plan.map((s) => {
        const st = c.perStage.find((p) => p.kind === s.kind);
        return st?.normalized == null ? "" : Math.round(st.normalized);
      });
      return [
        i + 1, c.full_name, c.email, c.phone, c.status,
        ...stageCells,
        c.composite ?? "", RECOMMENDATION_LABELS[c.recommendation],
        c.consent_at ?? "", c.invited_at ?? "", c.completed_at ?? "",
      ].map(csvCell).join(",");
    });
    // Prepend a UTF-8 BOM so Excel renders Arabic candidate names correctly.
    const BOM = String.fromCharCode(0xfeff);
    const csv = BOM + [header.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  const payload = {
    schema: "vifm-prehire-export@v1",
    exported_at: new Date().toISOString(),
    requisition: {
      id: requisition.id,
      title: requisition.title,
      level: requisition.level,
      status: requisition.status,
      english_required: requisition.english_required,
      organization_name: orgName,
      stages: plan.map((s) => ({
        kind: s.kind,
        label: PREHIRE_STAGE_LABELS[s.kind],
        weight: s.weight,
        cut_score: s.cut_score,
        required: s.required,
      })),
    },
    candidate_count: ranked.length,
    candidates: ranked.map((c, i) => ({
      rank: i + 1,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      composite: c.composite,
      recommendation: c.recommendation,
      recommendation_label: RECOMMENDATION_LABELS[c.recommendation],
      consent_at: c.consent_at,
      invited_at: c.invited_at,
      completed_at: c.completed_at,
      stages: plan.map((s) => {
        const st = c.perStage.find((p) => p.kind === s.kind);
        return {
          kind: s.kind,
          label: PREHIRE_STAGE_LABELS[s.kind],
          normalized: st?.normalized ?? null,
          passed: st?.passed ?? null,
        };
      }),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${baseName}.json"`,
    },
  });
}
