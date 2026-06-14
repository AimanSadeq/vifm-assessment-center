// Best-effort: render a completed sitting's PDF report and email it to the
// candidate. Called from the submit route. Never throws - a submit must not
// fail because email is down or unconfigured.
import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionReport } from "./service";
import { TechSandboxReport } from "@/lib/reports/tech-sandbox-report";
import { emailResults } from "./email";

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

export async function emailSessionResults(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = await getSessionReport(token);
    if (!data) return { ok: false, error: "Report not available" };
    if (!data.candidateEmail) return { ok: false, error: "No candidate email on file" };

    const buffer = await renderToBuffer(<TechSandboxReport data={data} />);
    const pdfBase64 = Buffer.from(buffer).toString("base64");
    const fileName = `vifm-technical-${slug(data.nodeId ?? "assessment")}-${slug(data.candidateName ?? "candidate")}.pdf`;

    return await emailResults({
      to: data.candidateEmail,
      name: data.candidateName ?? undefined,
      functionName: data.functionName,
      overallPct: data.overallPct,
      overallBand: data.overallBand,
      pdfBase64,
      fileName,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
