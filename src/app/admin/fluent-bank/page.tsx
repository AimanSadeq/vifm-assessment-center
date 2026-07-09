import { redirect } from "next/navigation";
import { Languages } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadFluentBank } from "@/lib/quiz-bank/fluent-admin";
import { FluentBankConsole } from "./_components/console";

export const dynamic = "force-dynamic";

export default async function FluentBankPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const view = await loadFluentBank();
  const { totals } = view;

  const metric = (value: string, label: string, tone = "text-[#010131]") => (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <BackLink href="/admin/item-banks" label="Item banks" history />
      <header>
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-[#010131]">
          <Languages className="h-6 w-6 text-[#5391D5]" /> Fluent receptive bank
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The vetted CEFR-ramped reading + listening items. Review and promote items to <strong>live</strong> - a skill
          serves from the bank (instead of live-AI) once every CEFR level has enough live items. Writing + speaking are
          AI-scored tasks (not a bank).
        </p>
      </header>

      {!view.tableReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The <code>eng_fluent_items</code> review states aren&apos;t present yet. Apply migration <code>00181</code>.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metric(`${totals.live}`, "Live (served) items", totals.live > 0 ? "text-emerald-700" : undefined)}
        {metric(`${totals.inReview}`, "In review (awaiting promotion)", totals.inReview > 0 ? "text-amber-600" : undefined)}
        {metric(totals.readingServable ? "Yes" : "No", "Reading ramp servable", totals.readingServable ? "text-emerald-700" : "text-rose-600")}
        {metric(totals.listeningServable ? "Yes" : "No", "Listening ramp servable", totals.listeningServable ? "text-emerald-700" : "text-rose-600")}
      </div>

      <FluentBankConsole cells={view.cells} />
    </div>
  );
}
