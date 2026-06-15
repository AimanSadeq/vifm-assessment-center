"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Link2, Unlink, ArrowRight, Loader2, AlertTriangle, Layers, Aperture } from "lucide-react";
import { setAssessmentModeAction, linkReflectEngagementAction } from "../actions";
import type { ReadinessSetup, CandidateReadinessStatus } from "@/lib/scoring/readiness-setup";

const TIER_META: Record<string, { label: string; cls: string }> = {
  ready_now: { label: "Ready Now", cls: "bg-emerald-100 text-emerald-800" },
  ready_soon: { label: "Ready Soon", cls: "bg-sky-100 text-sky-800" },
  developing: { label: "Developing", cls: "bg-amber-100 text-amber-800" },
  not_ready: { label: "Not Ready", cls: "bg-rose-100 text-rose-800" },
  insufficient_data: { label: "Insufficient data", cls: "bg-slate-100 text-slate-500" },
};

const PERSONA_META: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Persona done", cls: "bg-emerald-100 text-emerald-800" },
  in_progress: { label: "Persona started", cls: "bg-amber-100 text-amber-800" },
  not_started: { label: "Persona not started", cls: "bg-slate-100 text-slate-500" },
};

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function ReflectChip({ c }: { c: CandidateReadinessStatus }) {
  if (!c.reflectLinked) return <Chip label="360 not linked" cls="bg-slate-100 text-slate-500" />;
  const done = c.reflectRatersDone, total = c.reflectRatersTotal;
  const cls = total > 0 && done >= total ? "bg-emerald-100 text-emerald-800" : done > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500";
  return <Chip label={`360 ${done}/${total} raters`} cls={cls} />;
}

export function ReadinessSetupPanel({ engagementId, setup }: { engagementId: string; setup: ReadinessSetup }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");

  const setMode = (mode: "standalone" | "combined") =>
    start(async () => {
      const res = await setAssessmentModeAction(engagementId, mode);
      if ("error" in res) toast.error(res.error || "Could not update mode");
      else { toast.success(`Mode set to ${mode}`); router.refresh(); }
    });

  const link = (reflectEngagementId: string | null) =>
    start(async () => {
      const res = await linkReflectEngagementAction(engagementId, reflectEngagementId);
      if ("error" in res) { toast.error(res.error || "Could not link"); return; }
      if (reflectEngagementId) toast.success(`Linked - bridged ${res.linked} candidate(s), mapped ${res.mapped} competency(ies)`);
      else toast.success("Unlinked");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-accent" /> Succession Readiness setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Combined readiness fuses <strong>Persona</strong> (self) with a <strong>Reflect 360</strong> (others) against each
          candidate&rsquo;s target role. Set the mode, link the 360, then open each candidate&rsquo;s readiness report.
        </p>

        {/* Mode */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-[#010131]">Assessment mode</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {(["standalone", "combined"] as const).map((m) => (
              <button
                key={m}
                disabled={pending}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition disabled:opacity-50 ${
                  setup.mode === m ? "bg-[#010131] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {setup.mode === "combined"
              ? "Persona carries self; the 360 self-rater is suppressed."
              : "Each instrument keeps its own self-rating."}
          </span>
        </div>

        {/* Reflect 360 link */}
        <div className="rounded-lg border border-slate-200 p-3">
          {!setup.linkColumnReady ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Apply migration 00099 to enable Reflect 360 linking.
            </p>
          ) : setup.reflectEngagementId ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm">
                <Aperture className="h-4 w-4 text-teal-600" />
                Linked to <strong>{setup.reflectEngagementName ?? "a Reflect 360"}</strong>
              </span>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => link(null)}>
                {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Unlink className="mr-1 h-3.5 w-3.5" />}
                Unlink
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[14rem] flex-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Link a Reflect 360 (others view)</span>
                <select
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a Reflect 360 engagement…</option>
                  {setup.reflectOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
              <Button disabled={pending || !pick} onClick={() => link(pick)}>
                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
                Link &amp; enable combined
              </Button>
            </div>
          )}
        </div>

        {/* Per-candidate status */}
        {setup.candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">Add candidates to track readiness.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">Candidate</th>
                  <th className="py-2 pe-3 font-medium">Role</th>
                  <th className="py-2 pe-3 font-medium">Persona (self)</th>
                  <th className="py-2 pe-3 font-medium">Reflect 360 (others)</th>
                  <th className="py-2 pe-3 font-medium">Readiness</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {setup.candidates.map((c) => {
                  const persona = PERSONA_META[c.persona] ?? PERSONA_META.not_started;
                  const tier = c.readinessTier ? TIER_META[c.readinessTier] ?? { label: c.readinessTier, cls: "bg-slate-100 text-slate-600" } : null;
                  return (
                    <tr key={c.candidateId} className="border-b last:border-0">
                      <td className="py-2 pe-3 font-medium text-[#010131]">{c.name}</td>
                      <td className="py-2 pe-3">
                        {c.roleBound ? <Chip label="Role bound" cls="bg-sky-100 text-sky-800" /> : <Chip label="No role" cls="bg-rose-50 text-rose-600" />}
                      </td>
                      <td className="py-2 pe-3"><Chip label={persona.label} cls={persona.cls} /></td>
                      <td className="py-2 pe-3"><ReflectChip c={c} /></td>
                      <td className="py-2 pe-3">{tier ? <Chip label={tier.label} cls={tier.cls} /> : <span className="text-xs text-muted-foreground">not computed</span>}</td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/admin/engagements/${engagementId}/readiness/${c.candidateId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        >
                          Readiness report <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-[#c026d3]" /> Persona is run from the Psychometrics portal or the candidate&rsquo;s skills page.</span>
          <span className="inline-flex items-center gap-1"><Aperture className="h-3.5 w-3.5 text-teal-600" /> The 360 is run in Reflect 360.</span>
        </div>
      </CardContent>
    </Card>
  );
}
