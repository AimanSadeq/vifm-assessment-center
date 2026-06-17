import Link from "next/link";
import { getSessionByToken, getPublicBlueprint, getSessionReport } from "@/lib/technical-sandbox/service";
import { MCQ_FLOOR, SANDBOX_FLOOR, OVERALL_BAR } from "@/lib/technical-sandbox/combined";
import { stripAnswerKey, type PublicTechTest, type TechTest } from "@/lib/ai/technical-assessment";
import { Runner, type SubmitResult } from "./_components/runner";

export const dynamic = "force-dynamic";

type Band = "basic" | "intermediate" | "advanced";

/** Rebuild the results payload from the persisted session + per-block report so
 *  a reload after submit still shows the score panels + credential-verify link. */
async function buildInitialResult(
  token: string,
  session: Record<string, unknown>,
  mcqPct: number,
): Promise<SubmitResult["result"] | null> {
  if (session.status !== "submitted") return null;
  const report = await getSessionReport(token);
  const score = report
    ? {
        overallPct: report.overallPct,
        overallTier: report.overallBand as Band,
        pillars: report.pillars.map((p) => ({
          nameEn: p.nameEn,
          advancedCount: p.advancedCount,
          intermediateCount: p.intermediateCount,
          basicCount: p.basicCount,
          blocks: p.blocks.map((b) => ({
            nameEn: b.nameEn,
            scorePct: b.scorePct,
            tier: b.band as Band,
            checkpointResults: b.checkpoints.map((c, i) => ({
              id: `${b.nameEn}-${i}`,
              passed: c.passed,
              label_en: c.label,
            })),
          })),
        })),
      }
    : undefined;

  const mcqScorePct = session.mcq_score_pct != null ? Number(session.mcq_score_pct) : null;
  const sandboxScorePct = Number(session.overall_score_pct ?? 0);
  const hasMcqSection = mcqPct > 0 && mcqScorePct != null;
  let combined: NonNullable<SubmitResult["result"]>["combined"] | undefined;
  if (hasMcqSection) {
    const combinedPct =
      session.combined_score_pct != null ? Number(session.combined_score_pct) : sandboxScorePct;
    const credentialCode = (session.credential_code as string) ?? null;
    combined = {
      mcqPct,
      hasMcqSection: true,
      mcqScorePct,
      sandboxScorePct,
      combinedPct,
      combinedBand: (session.combined_band as Band) ?? (session.overall_band as Band) ?? "basic",
      mcqPassed: (mcqScorePct ?? 0) >= MCQ_FLOOR,
      sandboxPassed: sandboxScorePct >= SANDBOX_FLOOR,
      passed:
        (mcqScorePct ?? 0) >= MCQ_FLOOR && sandboxScorePct >= SANDBOX_FLOOR && combinedPct >= OVERALL_BAR,
      // credential => the knowledge section was bank-certified (best-effort rehydrate).
      certified: !!credentialCode,
      credentialCode,
    };
  }
  return { score, combined };
}

export default async function TechSandboxPage({ params }: { params: { token: string } }) {
  const session = await getSessionByToken(params.token);
  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Invalid or expired link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This assessment link is not valid. Please contact your administrator.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-[#5391D5] hover:underline">
          Home
        </Link>
      </div>
    );
  }
  const blueprint = await getPublicBlueprint(session.function_id);

  // The combined assessment carries an MCQ knowledge section. Strip the answer
  // key server-side so the browser never receives the correct options.
  const mcqPct = Math.max(0, Math.min(100, Math.round(Number(session.mcq_pct ?? 0))));
  const keyedMcq = (session.mcq_test ?? null) as TechTest | null;
  const mcqTest: PublicTechTest | null =
    mcqPct > 0 && keyedMcq && Array.isArray(keyedMcq.items) && keyedMcq.items.length > 0
      ? stripAnswerKey(keyedMcq)
      : null;

  // The candidate must NOT see results on completion - the scored report goes to
  // the client / VIFM admin (admin results view + admin-gated PDF). So the
  // candidate runner is never seeded with results; on submit it shows only a
  // confirmation. (buildInitialResult is retained for the admin-side view.)
  void buildInitialResult;

  return (
    <Runner
      token={params.token}
      blueprint={blueprint}
      initialStatus={session.status}
      mcqPct={mcqPct}
      mcqTest={mcqTest}
      initialResult={null}
      initialExpiresAt={(session.expires_at as string) ?? null}
    />
  );
}
