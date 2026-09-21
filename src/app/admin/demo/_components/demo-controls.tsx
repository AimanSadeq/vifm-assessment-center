"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Database, Trash2, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { seedDemoDataAction, purgeDemoDataAction, rebuildDemoDataAction } from "../actions";

type Tone = "created" | "unchanged" | "error";
type Line = { label: string; note: string; tone: Tone };

const TONE_DOT: Record<Tone, string> = {
  created: "bg-emerald-500",
  unchanged: "bg-amber-500",
  error: "bg-rose-500",
};

type SeedOutcome = { service: string; label: string; created: number; note?: string };
type PurgeOutcome = { step: string; note: string; ok: boolean };

/**
 * A seeder that created nothing changed nothing, whatever its note says. Saying
 * so in amber is the whole point: a load on top of existing data used to report
 * every service in green under a success toast, so a demo that had not actually
 * been refreshed looked exactly like one that had.
 */
const seedLines = (res: SeedOutcome[]): Line[] =>
  res.map((r) => {
    if (r.service === "error") return { label: r.label, note: r.note ?? "failed", tone: "error" as const };
    if (r.created > 0) {
      return { label: r.label, note: `${r.created} created - ${r.note ?? ""}`.trim(), tone: "created" as const };
    }
    return { label: r.label, note: `unchanged - ${r.note ?? "nothing to do"}`, tone: "unchanged" as const };
  });

const purgeLines = (res: PurgeOutcome[]): Line[] =>
  res.map((r) => ({ label: r.step, note: r.note, tone: r.ok ? "created" : "error" }));

function reportSeed(res: SeedOutcome[]) {
  const failed = res.filter((r) => r.service === "error").length;
  const created = res.filter((r) => r.service !== "error" && r.created > 0).length;
  if (failed > 0) {
    toast.error(`${failed} of ${res.length} services failed. See the result below.`);
    return;
  }
  if (created === 0) {
    toast.warning("Nothing was loaded - every service already has demo data. Use Rebuild to refresh it.");
    return;
  }
  toast.success(`Demo data loaded (${created} of ${res.length} services).`);
}

export function DemoControls({ orgPresent }: { orgPresent: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"seed" | "purge" | "rebuild" | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);

  const run = (kind: "seed" | "purge" | "rebuild", fn: () => Promise<void>) => {
    setBusy(kind);
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not complete that.");
      } finally {
        setBusy(null);
      }
    });
  };

  const runSeed = () =>
    run("seed", async () => {
      const res = await seedDemoDataAction();
      setLines(seedLines(res));
      reportSeed(res);
    });

  const runPurge = () => {
    if (!confirm("Remove all demo data (the Najm Capital demo org and everything under it)? Real client data is not touched.")) return;
    run("purge", async () => {
      const res = await purgeDemoDataAction();
      setLines(purgeLines(res));
      toast.success("Demo data removed");
    });
  };

  const runRebuild = () => {
    if (!confirm("Rebuild removes the demo data and loads it again, so every demo record gets a new id and any link you saved will be stale. Real client data is not touched. Continue?")) return;
    run("rebuild", async () => {
      const { purged, seeded } = await rebuildDemoDataAction();
      setLines([...purgeLines(purged), ...seedLines(seeded)]);
      reportSeed(seeded);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {orgPresent ? (
          <Button onClick={runRebuild} disabled={pending} className="gap-2">
            {busy === "rebuild" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rebuild demo data
          </Button>
        ) : (
          <Button onClick={runSeed} disabled={pending} className="gap-2">
            {busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Load demo cohort
          </Button>
        )}
        {orgPresent && (
          <Button onClick={runSeed} disabled={pending} variant="outline" className="gap-2">
            {busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Load missing services
          </Button>
        )}
        <Button onClick={runPurge} disabled={pending || !orgPresent} variant="outline" className="gap-2 text-rose-600 hover:text-rose-700">
          {busy === "purge" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Remove demo data
        </Button>
      </div>

      {orgPresent && (
        <p className="text-xs text-muted-foreground">
          Loading only fills in services that have no demo data yet; it never refreshes what is already there.
          To pick up a change to the seeder, rebuild.
        </p>
      )}

      {lines && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</div>
          <ul className="space-y-1 text-sm">
            {lines.map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${TONE_DOT[l.tone]}`} />
                <span className="font-medium text-foreground">{l.label}:</span>
                <span className="text-muted-foreground">{l.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {orgPresent && (
        <p className="text-xs text-muted-foreground">
          Demo data is loaded. Walk it from the guided demos, or jump straight in:{" "}
          <Link href="/admin/engagements" className="inline-flex items-center gap-1 text-accent hover:underline">
            Engagements <ExternalLink className="h-3 w-3" />
          </Link>
          .
        </p>
      )}
    </div>
  );
}
