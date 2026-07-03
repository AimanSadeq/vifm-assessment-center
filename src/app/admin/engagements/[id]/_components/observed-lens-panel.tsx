// B3 - AC observed-evidence DARE + EQ lens. Server component: renders a
// candidate's wash-up consensus scores re-grouped into the VIFM DARE decision
// roles and Goleman EQ quadrants, with per-group coverage badges (an AC only
// observes a subset of the 41 - the badge keeps the lens honest). Shown only
// when a candidate is focused via ?candidate=<id> and consensus scores exist.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, HeartHandshake } from "lucide-react";
import type { AcObservedLens } from "@/lib/scoring/ac-observed-lens";
import type { LensGroupRead } from "@/lib/reports/lens-shared";

function GroupRow({ g }: { g: LensGroupRead }) {
  const rated = g.rows.filter((r) => r.others != null);
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.hex }} />
        <span className="text-sm font-semibold text-[#010131]">{g.label}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
          {g.inInstrument} of {g.totalInModel} in design
        </span>
        <span className="ml-auto text-sm font-bold tabular-nums text-[#010131]">
          {g.others != null ? g.others.toFixed(2) : "-"}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        {g.others != null && (
          <div
            className="h-full rounded-full"
            style={{ width: `${(g.others / 5) * 100}%`, background: g.hex }}
          />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {rated.map((r) => (
          <span
            key={r.id}
            className="rounded border bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
          >
            {r.name} · <span className="font-semibold tabular-nums">{r.others!.toFixed(1)}</span>
          </span>
        ))}
        {rated.length === 0 && (
          <span className="text-[11px] italic text-slate-400">
            In the design, no consensus score yet
          </span>
        )}
      </div>
    </div>
  );
}

export function ObservedLensPanel({
  lens,
  candidateName,
}: {
  lens: AcObservedLens;
  candidateName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          VIFM lens - DARE + EQ (observed evidence) · {candidateName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          The wash-up consensus scores ({lens.ratedCount} of {lens.designCount} designed
          competencies scored) re-read through the VIFM DARE decision roles and the Goleman EQ
          quadrants. Observed evidence is the strongest tier of the measurement model - but an
          Assessment Center covers a subset of the 41, so each group shows how many of its model
          competencies this engagement was designed to observe.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
            <GitBranch className="h-4 w-4 text-[#4f46e5]" /> DARE - decision roles
          </div>
          {lens.dare.map((g) => (
            <GroupRow key={g.key} g={g} />
          ))}
          {lens.dare.length === 0 && (
            <p className="text-sm italic text-slate-400">
              No DARE-mapped competencies in this engagement&apos;s design.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
            <HeartHandshake className="h-4 w-4 text-[#d97706]" /> EQ - Goleman quadrants
          </div>
          {lens.eq.map((g) => (
            <GroupRow key={g.key} g={g} />
          ))}
          {lens.eq.length === 0 && (
            <p className="text-sm italic text-slate-400">
              No EQ-mapped competencies in this engagement&apos;s design (EQ covers 22 of the 41).
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
