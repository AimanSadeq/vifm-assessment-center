import { redirect } from "next/navigation";
import { UserSquare2 } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadPersonaBankAdmin } from "@/lib/persona/bank-admin";
import { PersonaBankConsole } from "./_components/console";

export const dynamic = "force-dynamic";

export default async function PersonaBankPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const view = await loadPersonaBankAdmin();
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
          <UserSquare2 className="h-6 w-6 text-[#5391D5]" /> Persona item bank
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The behavioural self-report items (41 competencies x 4). Persona serves fixed items (never live-AI), but a
          result is flagged <strong>provisional</strong> until its items are SME-approved here.
        </p>
      </header>

      {!view.tableReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The <code>persona_items</code> table isn&apos;t present yet. Apply migration <code>00185</code> and run
          <code> scripts/seed-persona-bank.ts</code>.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {metric(`${totals.approved}`, "SME-approved items", totals.approved > 0 ? "text-emerald-700" : undefined)}
        {metric(`${totals.pending}`, "Pending review", totals.pending > 0 ? "text-amber-600" : undefined)}
        {metric(`${totals.total}`, "Total items")}
      </div>

      <PersonaBankConsole competencies={view.competencies} totalPending={totals.pending} />
    </div>
  );
}
