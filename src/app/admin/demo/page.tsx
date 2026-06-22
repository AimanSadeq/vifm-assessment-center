import { Database, ShieldCheck } from "lucide-react";
import { getDemoStatus } from "@/lib/demo/status";
import { DemoControls } from "./_components/demo-controls";

export const dynamic = "force-dynamic";

export default async function DemoDataPage() {
  const status = await getDemoStatus();
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary">Demo data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One click seeds a fictional GCC client (Najm Capital) with realistic, populated data so the
            guided demos walk through full screens instead of empty states. Everything is tagged and fully
            removable - it never touches real client data.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Status
        </div>
        {status.orgPresent ? (
          <ul className="space-y-1 text-sm">
            <li className="text-foreground">Demo organisation: <span className="font-medium">loaded</span></li>
            {status.counts.map((c) => (
              <li key={c.service} className="text-muted-foreground">
                {c.label}: <span className="font-medium text-foreground">{c.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No demo data loaded yet.</p>
        )}
      </div>

      <DemoControls orgPresent={status.orgPresent} />
    </div>
  );
}
