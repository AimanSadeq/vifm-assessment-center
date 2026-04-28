export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import type { CandidateQuizAttempt, QuizQuestion, QuizAnswer } from "@/types/database";

type Props = { params: { attemptId: string } };

const DIFFICULTY_TONES: Record<
  QuizQuestion["difficulty"],
  { bg: string; fg: string; border: string; label: string }
> = {
  easy:   { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0", label: "Easy" },
  medium: { bg: "#fffbeb", fg: "#a16207", border: "#fde68a", label: "Medium" },
  hard:   { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca", label: "Hard" },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default async function QuizResultsPage({ params }: Props) {
  const supabase = await createClient();
  const { attemptId } = params;

  const { data: attempt, error } = await supabase
    .from("candidate_quiz_attempts")
    .select(
      "id, candidate_id, competency_id, status, questions, answers, score_pct, correct_count, total_count, passing_score_pct, time_taken_seconds, started_at, completed_at, competencies(id, name)"
    )
    .eq("id", attemptId)
    .single();

  if (error || !attempt) return notFound();

  const a = attempt as unknown as CandidateQuizAttempt & {
    competencies: { id: string; name: string } | null;
  };

  const questions: QuizQuestion[] = a.questions;
  const answers: QuizAnswer[] = a.answers;

  const passed = (a.score_pct ?? 0) >= a.passing_score_pct;
  const abandoned = a.status === "abandoned";

  // Pick header tone:
  //   passed → green "Well done"
  //   abandoned → amber "Session ended early"
  //   completed-but-failed → rose "Keep Learning!"
  const headerTone = abandoned
    ? { bg: "#fffbeb", fg: "#a16207", border: "#fde68a", icon: "⏸", title: "Session Ended" }
    : passed
      ? { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0", icon: "✓", title: "Well done!" }
      : { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca", icon: "📚", title: "Keep Learning!" };

  const competencyName = a.competencies?.name ?? "Skill";
  const scoreLabel = a.score_pct !== null ? `${Math.round(a.score_pct)}%` : "—";
  const scoreFraction = (a.score_pct ?? 0) / 100;

  return (
    <div className="space-y-6">
      <BackLink href={`/candidate/skills/${a.candidate_id}`} label="Back to My Skills" />

      {/* Banner */}
      <div
        className="rounded-md border p-5"
        style={{
          backgroundColor: headerTone.bg,
          borderColor: headerTone.border,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">{headerTone.icon}</div>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: headerTone.fg }}>
              {competencyName}
            </p>
            <p className="text-xl font-bold" style={{ color: headerTone.fg }}>
              {headerTone.title}
            </p>
            <p className="text-xs mt-0.5" style={{ color: headerTone.fg, opacity: 0.85 }}>
              {abandoned
                ? "You can retake the quiz at any time to improve your score."
                : passed
                  ? "Great work on this competency. Try a harder one next."
                  : "You can retake the quiz at any time to improve your score."}
            </p>
          </div>
        </div>
      </div>

      {/* Score circle + stat cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="sm:col-span-1">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
            <ScoreCircle pct={scoreFraction} label={scoreLabel} />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Your Score</p>
          </CardContent>
        </Card>

        <StatCard
          label="Time Taken"
          value={
            a.time_taken_seconds !== null ? formatDuration(a.time_taken_seconds) : "—"
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Passing Score"
          value={`${Math.round(a.passing_score_pct)}%`}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Correct Answers"
          value={
            a.correct_count !== null ? `${a.correct_count}/${a.total_count}` : "—"
          }
          icon={passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
        />
      </div>

      {/* Per-question review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Questions for Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => {
            const picked = answers[i]?.picked_index;
            const isCorrect = picked === q.correct_index;
            const wasAnswered = picked !== null && picked !== undefined;
            const tone = DIFFICULTY_TONES[q.difficulty];

            return (
              <div key={q.id} className="rounded-md border p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Question {i + 1}
                  </p>
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
                  >
                    {tone.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {q.points} pts
                  </Badge>
                  {q.type === "pattern_recognition" && (
                    <Badge variant="outline" className="text-[10px]">
                      Pattern
                    </Badge>
                  )}
                  <span className="ms-auto inline-flex items-center gap-1 text-[11px]">
                    {!wasAnswered ? (
                      <>
                        <span className="text-amber-600">Skipped</span>
                      </>
                    ) : isCorrect ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Correct</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        <span className="text-rose-700">Incorrect</span>
                      </>
                    )}
                  </span>
                </div>

                <p className="text-sm leading-relaxed">{q.prompt_en}</p>

                {q.type === "pattern_recognition" && q.sequence && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {q.sequence.map((cell, ci) => (
                      <div
                        key={ci}
                        className={`flex items-center justify-center min-w-[40px] h-10 rounded-md border text-sm font-semibold ${
                          cell === null ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-muted/50"
                        }`}
                      >
                        {cell === null ? "?" : String(cell)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Picked + correct rows */}
                <div className="grid gap-1.5 text-sm">
                  {wasAnswered && (
                    <div
                      className={`rounded-md border px-3 py-2 ${
                        isCorrect
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-rose-50 border-rose-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        )}
                        <span className="text-[11px] font-semibold uppercase tracking-wide">
                          Your answer
                        </span>
                      </div>
                      <p className="text-sm mt-1">{q.options_en[picked!]}</p>
                    </div>
                  )}
                  {!isCorrect && (
                    <div className="rounded-md border bg-emerald-50 border-emerald-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide">
                          Correct answer
                        </span>
                      </div>
                      <p className="text-sm mt-1">{q.options_en[q.correct_index]}</p>
                    </div>
                  )}
                </div>

                {/* AI explanation tip box */}
                <div className="rounded-md border bg-accent/5 border-accent/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                      Explanation
                    </span>
                  </div>
                  <p className="text-sm mt-1 text-foreground/80 leading-relaxed">
                    {q.explanation_en}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/candidate/skills/${a.candidate_id}`}>
          <Button variant="outline">Back to My Skills</Button>
        </Link>
        <Link
          href={`/candidate/skills/${a.candidate_id}?retakeCompetencyId=${a.competency_id}`}
        >
          <Button className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retake Quiz
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function ScoreCircle({ pct, label }: { pct: number; label: string }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, pct)));
  const colour = pct >= 0.7 ? "#047857" : pct >= 0.4 ? "#a16207" : "#b91c1c";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colour}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        fill="none"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontWeight: 700, fontSize: 18 }}
      >
        {label}
      </text>
    </svg>
  );
}
