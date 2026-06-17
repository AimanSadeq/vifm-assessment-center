import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionReport } from "@/lib/technical-sandbox/service";
import { TechSandboxReport } from "@/lib/reports/tech-sandbox-report";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tech-sandbox/[token]/report -> the scored PDF. This is a CLIENT / VIFM
// admin deliverable and must NEVER be fetchable by the candidate (who holds the
// token). /api/tech-sandbox/* is auth-bypassed in middleware for the candidate
// flow, so admin is enforced explicitly here.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
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
    if (isAuthorizationError(e)) return new Response("Not authorized.", { status: 403 });
    throw e;
  }
  const data = await getSessionReport(params.token);
  if (!data) {
    return new Response("Report not available (assessment not yet submitted).", { status: 404 });
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
