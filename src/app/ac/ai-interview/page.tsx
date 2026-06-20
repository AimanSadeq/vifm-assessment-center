import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot } from "lucide-react";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { DesignTargetRolesLink } from "@/components/shared/design-target-roles-link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller, type AraCaller } from "@/lib/ara/auth-guards";
import { getServerT } from "@/lib/i18n/server";
import { isAIConfigured } from "@/lib/ai/client";
import {
  CbiInterviewClient,
  type CompetencyOption,
  type CbiAssignmentContext,
} from "./_components/interview-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Conversational Assessor · Prototype",
};

async function fetchCompetencies(): Promise<CompetencyOption[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("competencies")
    .select("id, name, cluster_id")
    .order("sort_order");
  return (data ?? []) as CompetencyOption[];
}

type AssignmentRow = {
  id: string;
  engagement_id: string;
  candidate_id: string;
  exercise_id: string;
  candidates: { full_name: string } | null;
  exercises: { name: string; exercise_type: string } | null;
  engagements: { name: string } | null;
};
type MatrixRow = {
  engagement_id: string;
  exercise_id: string;
  competencies: { id: string; name: string } | null;
};

// CBI-type assignments + the competencies mapped to each (so an assessor
// can run the AI interview inside a real candidate/exercise context and
// write the reviewed result back into the observation/rating pipeline).
async function fetchCbiAssignments(caller: AraCaller): Promise<CbiAssignmentContext[]> {
  const sb = createServiceClient();
  let query = sb
    .from("assessor_assignments")
    .select(
      "id, engagement_id, candidate_id, exercise_id, candidates(full_name), exercises!inner(name, exercise_type), engagements(name)"
    )
    .eq("exercises.exercise_type", "competency_based_interview");
  // Assessors see only their own CBI assignments; admins see all.
  if (caller.role !== "admin") query = query.eq("assessor_id", caller.uid);
  const { data: rawAssigns } = await query;

  const assigns = (rawAssigns ?? []) as unknown as AssignmentRow[];
  if (assigns.length === 0) return [];

  const engIds = Array.from(new Set(assigns.map((a) => a.engagement_id)));
  const exIds = Array.from(new Set(assigns.map((a) => a.exercise_id)));
  const { data: rawMatrix } = await sb
    .from("exercise_competency_matrix")
    .select("engagement_id, exercise_id, competency_id, competencies(id, name)")
    .in("engagement_id", engIds)
    .in("exercise_id", exIds);
  const matrix = (rawMatrix ?? []) as unknown as MatrixRow[];

  return assigns.map((a) => ({
    id: a.id,
    engagementId: a.engagement_id,
    candidateId: a.candidate_id,
    candidateName: a.candidates?.full_name ?? "Candidate",
    exerciseName: a.exercises?.name ?? "Interview",
    engagementName: a.engagements?.name ?? "",
    competencies: matrix
      .filter((m) => m.engagement_id === a.engagement_id && m.exercise_id === a.exercise_id)
      .map((m) => m.competencies)
      .filter((c): c is { id: string; name: string } => Boolean(c))
      .map((c) => ({ id: c.id, name: c.name })),
  }));
}

export default async function AiInterviewPage() {
  // Assessor (or admin) only - the CBI write-path feeds the rating pipeline.
  const caller = await getCurrentCaller();
  if (!caller || !["lead_assessor", "associate_assessor", "admin"].includes(caller.role)) {
    notFound();
  }
  const [competencies, assignments, aiConfigured, t] = await Promise.all([
    fetchCompetencies(),
    fetchCbiAssignments(caller),
    Promise.resolve(isAIConfigured()),
    getServerT(),
  ]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> {t("acTools.interview.backLink")}
            </Link>
            <DesignTargetRolesLink />
            <AllServicesLink />
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">
              {t("acTools.interview.title")}
            </h1>
            <span className="ms-2 rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5391D5]">
              {t("acTools.interview.beta")}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("acTools.interview.introMain")}
            <strong>{t("acTools.interview.introEmphasis")}</strong>
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!aiConfigured && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>{t("acTools.interview.noKeyStrong")}</strong>
            {t("acTools.interview.noKeyBody1")}
            <code className="text-xs">ANTHROPIC_API_KEY</code>
            {t("acTools.interview.noKeyBody2")}
          </div>
        )}
        <CbiInterviewClient competencies={competencies} assignments={assignments} />
      </main>
    </div>
  );
}
