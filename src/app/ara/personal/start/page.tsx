import { validateTalentLens } from "@/lib/constants/ara-individual-factors";
import { startPersonalAssessmentAction } from "./actions";
import { StartForm } from "./_components/start-form";

export const dynamic = "force-dynamic";

/**
 * Personal AI Readiness Snapshot - anonymous, self-served entry.
 *
 * The page is intentionally a thin server shell; all the visible
 * surface (header, factor preview cards, form, footnote) lives in
 * StartForm so the language toggle inside it can drive every string
 * reactively. Without the lift, the toggle only set the respondent's
 * downstream language preference and the start page stayed in English.
 */
export default function PersonalAssessmentStartPage({
  searchParams,
}: {
  searchParams?: { lens?: string };
}) {
  // Talent lens captured from the launching pillar (migration 00134) and
  // threaded into the start form so the action can persist it on creation.
  const lens = validateTalentLens(searchParams?.lens);
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <StartForm action={startPersonalAssessmentAction} lens={lens} />
      </div>
    </div>
  );
}
