import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { buildHipoPdfData } from "@/lib/reports/persona-hipo-data";
import { HipoReportPdf } from "@/lib/reports/persona-hipo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * VIFM High-Potential Profile for a bespoke bundle candidate (Persona +
 * Logica sitting). Same auth surface as the combined bundle report:
 * staff always; client_manager only for candidates in their own org.
 * Deliberately OUTSIDE /api/bundle/ (that prefix is middleware-bypassed).
 */
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(_req: Request, { params }: { params: { candidateId: string } }) {
  if (!UUID_RE.test(params.candidateId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  const sb = createServiceClient();
  const { data: cand } = await sb
    .from("bundle_candidates")
    .select("id, full_name, organization_id, persona_session_id, cognitive_result_id")
    .eq("id", params.candidateId)
    .maybeSingle<{
      id: string; full_name: string; organization_id: string | null;
      persona_session_id: string | null; cognitive_result_id: string | null;
    }>();
  if (!cand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!cand.persona_session_id) {
    return NextResponse.json(
      { error: "The High-Potential Profile needs a completed Persona sitting on this bundle." },
      { status: 400 },
    );
  }
  if (clientMgrOrgId && cand.organization_id !== clientMgrOrgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let orgName: string | null = null;
  if (cand.organization_id) {
    const { data: org } = await sb.from("organizations").select("name").eq("id", cand.organization_id).maybeSingle();
    orgName = (org?.name as string) ?? null;
  }

  const built = await buildHipoPdfData({
    personaSessionId: cand.persona_session_id,
    cognitiveResultId: cand.cognitive_result_id,
    orgName,
    organizationId: cand.organization_id,
    bundleCandidateId: cand.id,
  });
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

  // Spec guardrail (docs/hipo-engagement-pillar-spec.md section 6): the client
  // download says "manager-rated" without naming the individual manager. Staff
  // (admin/consultant/assessor) keep the rater identity.
  if (clientMgrOrgId && built.data.engagement) {
    built.data.engagement = { ...built.data.engagement, managerName: "" };
  }

  const buffer = await renderToBuffer(<HipoReportPdf d={built.data} />);
  const safe = (cand.full_name || "Candidate").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") || "Candidate";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="VIFM_HighPotential_Profile_${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
