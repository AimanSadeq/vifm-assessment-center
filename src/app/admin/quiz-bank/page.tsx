import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadCompetencyQuizBank, QUIZ_BANK_TARGET } from "@/lib/quiz-bank/admin";
import { QuizBankConsole } from "./_components/console";

export const dynamic = "force-dynamic";

export default async function QuizBankPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const view = await loadCompetencyQuizBank();
  const { totals } = view;

  const metric = (value: string, label: string, tone = "text-[#010131]") => (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <BackLink href="/admin/item-banks" label="Item banks" history />
      <header>
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-[#010131]">
          <ClipboardCheck className="h-6 w-6 text-[#5391D5]" /> Competency quiz bank
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The vetted situational-judgement items behind the Pre-Hire screen. Review a competency and approve its pool -
          a competency serves from the bank (instead of live-AI) once it has {QUIZ_BANK_TARGET}+ approved items.
        </p>
      </header>

      {!view.tableReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The <code>competency_quiz_items</code> table isn&apos;t present yet. Apply migration <code>00180</code>.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metric(`${totals.approved}`, "Approved (servable) items", totals.approved > 0 ? "text-emerald-700" : undefined)}
        {metric(`${totals.inReview}`, "In review (awaiting SME sign-off)", totals.inReview > 0 ? "text-amber-600" : undefined)}
        {metric(`${totals.competenciesReady}/41`, `Competencies at ${QUIZ_BANK_TARGET}+ approved`)}
        {metric(`${totals.total}`, "Total items in bank")}
      </div>

      <QuizBankConsole competencies={view.competencies} target={QUIZ_BANK_TARGET} />
    </div>
  );
}
