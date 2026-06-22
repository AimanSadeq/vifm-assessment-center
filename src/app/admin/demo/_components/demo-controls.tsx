"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Database, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { seedDemoDataAction, purgeDemoDataAction } from "../actions";

type Line = { label: string; note: string; ok?: boolean };

export function DemoControls({ orgPresent }: { orgPresent: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"seed" | "purge" | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);

  const runSeed = () => {
    setBusy("seed");
    start(async () => {
      try {
        const res = await seedDemoDataAction();
        setLines(res.map((r) => ({ label: r.label, note: r.created > 0 ? `${r.created} created - ${r.note ?? ""}`.trim() : r.note ?? "no change", ok: r.service !== "error" })));
        toast.success("Demo data loaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load demo data");
      } finally {
        setBusy(null);
      }
    });
  };

  const runPurge = () => {
    if (!confirm("Remove all demo data (the Najm Capital demo org and everything under it)? Real client data is not touched.")) return;
    setBusy("purge");
    start(async () => {
      try {
        const res = await purgeDemoDataAction();
        setLines(res.map((r) => ({ label: r.step, note: r.note, ok: r.ok })));
        toast.success("Demo data removed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove demo data");
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runSeed} disabled={pending} className="gap-2">
          {busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Load demo cohort
        </Button>
        <Button onClick={runPurge} disabled={pending || !orgPresent} variant="outline" className="gap-2 text-rose-600 hover:text-rose-700">
          {busy === "purge" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Remove demo data
        </Button>
      </div>

      {lines && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</div>
          <ul className="space-y-1 text-sm">
            {lines.map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${l.ok === false ? "bg-rose-500" : "bg-emerald-500"}`} />
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
