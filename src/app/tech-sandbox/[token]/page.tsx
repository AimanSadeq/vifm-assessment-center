import Link from "next/link";
import { getSessionByToken, getPublicBlueprint } from "@/lib/technical-sandbox/service";
import { stripAnswerKey, type PublicTechTest, type TechTest } from "@/lib/ai/technical-assessment";
import { Runner } from "./_components/runner";

export const dynamic = "force-dynamic";

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
  const selectedBlockIds = (session.selected_block_ids ?? null) as string[] | null;
  const blueprint = await getPublicBlueprint(session.function_id, selectedBlockIds);

  // The combined assessment carries an MCQ knowledge section. Strip the answer
  // key server-side so the browser never receives the correct options.
  const mcqPct = Math.max(0, Math.min(100, Math.round(Number(session.mcq_pct ?? 0))));
  const keyedMcq = (session.mcq_test ?? null) as TechTest | null;
  const mcqTest: PublicTechTest | null =
    mcqPct > 0 && keyedMcq && Array.isArray(keyedMcq.items) && keyedMcq.items.length > 0
      ? stripAnswerKey(keyedMcq)
      : null;

  // Zero-content guard: a sitting with no hands-on blocks AND no knowledge
  // section has nothing to assess. Render an honest notice instead of the
  // runner - a legacy empty session otherwise starts with a zero-second time
  // budget and auto-submits at 0 (live incident, 21 Jul 2026).
  const blockCount = blueprint.pillars.reduce((n, p) => n + p.blocks.length, 0);
  if (blockCount === 0 && !mcqTest && session.status !== "submitted") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">This assessment is not ready yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The assessment you were invited to has no content configured yet - there is nothing to
          answer. Nothing has been submitted on your behalf. Please contact the administrator who
          invited you.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-[#5391D5] hover:underline">
          Home
        </Link>
      </div>
    );
  }

  // The candidate must NOT see results - the scored report goes to the client /
  // VIFM admin (admin results view + admin-gated PDF). The candidate runner is
  // never seeded with results; on submit it shows only a confirmation.
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
