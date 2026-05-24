import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
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
async function fetchCbiAssignments(): Promise<CbiAssignmentContext[]> {
  const sb = createServiceClient();
  const { data: rawAssigns } = await sb
    .from("assessor_assignments")
    .select(
      "id, engagement_id, candidate_id, exercise_id, candidates(full_name), exercises!inner(name, exercise_type), engagements(name)"
    )
    .eq("exercises.exercise_type", "competency_based_interview");

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
  const [competencies, assignments, aiConfigured] = await Promise.all([
    fetchCompetencies(),
    fetchCbiAssignments(),
    Promise.resolve(isAIConfigured()),
  ]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Assessment Center
          </Link>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">
              AI Conversational Assessor
            </h1>
            <span className="ml-2 rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5391D5]">
              Beta
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A Claude agent runs a structured competency-based interview (STAR) in English or
            Arabic, then scores the transcript against the VIFM BARS scale. Pick a real
            candidate assignment to run it in context — the assessor reviews and approves the
            AI&apos;s draft, and on approval the evidence and rating are written into the normal
            observation → wash-up → consensus pipeline. <strong>The AI never writes a score
            without a human approving it.</strong>
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!aiConfigured && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>AI key not set.</strong> The interview and scoring run in deterministic
            fallback mode so you can see the full flow (including the review gate and pipeline
            write). Set <code className="text-xs">ANTHROPIC_API_KEY</code> for real
            Claude-driven interviewing.
          </div>
        )}
        <CbiInterviewClient competencies={competencies} assignments={assignments} />
      </main>
    </div>
  );
}
