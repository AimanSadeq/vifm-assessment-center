import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionReport } from "@/lib/technical-sandbox/service";
import { TechSandboxReport } from "@/lib/reports/tech-sandbox-report";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tech-sandbox/[token]/report -> the scored PDF. This is a CLIENT / VIFM
// admin deliverable and must NEVER be fetchable by the candidate (who holds the
// token). /api/tech-sandbox/* is auth-bypassed in middleware for the candidate
// flow, so authorization is enforced explicitly here: full access for admin, and
// a portal client_manager may download THEIR OWN org's report (the same org-id
// gate the on-screen results page applies). The candidate has no account, so
// getCurrentCaller() is null for them and they fall through to 403.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  let clientMgrOrgId: string | null = null;
  let clientMgrOrgName: string | null = null;
  let isClientManager = false;
  try {
    const caller = await requireRole(["admin"]);
    // Defence-in-depth: in production this scored PDF must never be served on a
    // synthetic dev-admin (which requireRole returns when AUTH_ENABLED is off),
    // or a misconfigured auth-off prod deploy would let the candidate's token
    // fetch it. (Local dev auth-off still works.)
    if (caller.isDev && process.env.NODE_ENV === "production") {
      return new Response("Not authorized.", { status: 403 });
    }
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    const caller = await getCurrentCaller();
    if (caller?.role === "client_manager") {
      isClientManager = true;
      clientMgrOrgId = await getClientOrgId();
      const { data: org } = clientMgrOrgId
        ? await createServiceClient().from("organizations").select("name").eq("id", clientMgrOrgId).maybeSingle<{ name: string }>()
        : { data: null };
      clientMgrOrgName = org?.name ?? null;
      if (!clientMgrOrgId && !clientMgrOrgName) return new Response("Not authorized.", { status: 403 });
    } else {
      return new Response("Not authorized.", { status: 403 });
    }
  }
  const data = await getSessionReport(params.token);
  if (!data) {
    return new Response("Report not available (assessment not yet submitted).", { status: 404 });
  }
  // Tenancy: a client_manager may only download a sitting their org OWNS. Prefer
  // the real organization_id (migration 00187); only a legacy/ambiguous sitting
  // with no org_id falls back to strict organization_name equality. Mirrors the
  // /admin/tech-sandbox/results/[token] page gate exactly.
  if (isClientManager) {
    const sittingOrgId = data.organizationId ?? null;
    if (sittingOrgId) {
      if (sittingOrgId !== clientMgrOrgId) return new Response("Not authorized.", { status: 403 });
    } else if (!clientMgrOrgName || (data.organizationName ?? null) !== clientMgrOrgName) {
      return new Response("Not authorized.", { status: 403 });
    }
  }
  const buffer = await renderToBuffer(<TechSandboxReport data={data} />);
  const safeName = (data.candidateName ?? "candidate").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `vifm-technical-${data.nodeId ?? "assessment"}-${safeName}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
