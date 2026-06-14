import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionReport } from "@/lib/technical-sandbox/service";
import { TechSandboxReport } from "@/lib/reports/tech-sandbox-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tech-sandbox/[token]/report -> downloadable PDF of the completed sitting.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
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
