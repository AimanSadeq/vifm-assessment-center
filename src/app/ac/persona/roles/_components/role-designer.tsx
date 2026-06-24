"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Save, Trash2, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extractRoleFromJdAction, saveTargetRoleAction, type DesignedCompetency } from "../actions";

type Region = "" | "uae" | "saudi" | "gcc" | "global";

// VIFM domain palette (matches the candidate skills / JD-extractor tally chips).
const DOMAIN_TW: Record<string, string> = {
  THINKING: "bg-sky-100 text-sky-800 border-sky-300",
  RESULTS: "bg-emerald-100 text-emerald-800 border-emerald-300",
  PEOPLE: "bg-amber-100 text-amber-800 border-amber-300",
  SELF: "bg-violet-100 text-violet-800 border-violet-300",
};
const domainTw = (d: string) => DOMAIN_TW[d] ?? "bg-slate-100 text-slate-700 border-slate-300";

export function RoleDesigner() {
  const router = useRouter();
  const [roleName, setRoleName] = useState("");
  const [region, setRegion] = useState<Region>("saudi");
  const [jd, setJd] = useState("");
  const [comps, setComps] = useState<DesignedCompetency[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const extract = async () => {
    setExtracting(true);
    const res = await extractRoleFromJdAction({ jobDescription: jd, roleName });
    setExtracting(false);
    if ("error" in res) return toast.error(res.error);
    if (res.competencies.length === 0) toast.message("No competencies extracted - try a fuller job description.");
    setComps(res.competencies);
  };

  const update = (id: string, patch: Partial<DesignedCompetency>) =>
    setComps((prev) => (prev ? prev.map((c) => (c.competencyId === id ? { ...c, ...patch } : c)) : prev));
  const remove = (id: string) =>
    setComps((prev) => (prev ? prev.filter((c) => c.competencyId !== id) : prev));

  // Group by DOMAIN (THINKING/RESULTS/PEOPLE/SELF) -> area -> competencies.
  const byDomain = useMemo(() => {
    const dm = new Map<string, { sort: number; areas: Map<string, DesignedCompetency[]> }>();
    for (const c of comps ?? []) {
      if (!dm.has(c.domain)) dm.set(c.domain, { sort: c.domainSort, areas: new Map() });
      const d = dm.get(c.domain)!;
      if (!d.areas.has(c.area)) d.areas.set(c.area, []);
      d.areas.get(c.area)!.push(c);
    }
    return [...dm.entries()]
      .sort((a, b) => a[1].sort - b[1].sort)
      .map(([domain, v]) => ({ domain, areas: [...v.areas.entries()] }));
  }, [comps]);

  // Domain rollup: count per domain, in framework order.
  const rollup = useMemo(() => {
    const m = new Map<string, { sort: number; n: number }>();
    for (const c of comps ?? []) {
      const e = m.get(c.domain) ?? { sort: c.domainSort, n: 0 };
      e.n += 1;
      m.set(c.domain, e);
    }
    return [...m.entries()].sort((a, b) => a[1].sort - b[1].sort).map(([domain, v]) => ({ domain, n: v.n }));
  }, [comps]);

  const count = comps?.length ?? 0;

  const save = async () => {
    if (!roleName.trim()) return toast.error("Give the role a name.");
    if (!comps || comps.length === 0) return toast.error("Extract competencies from a job description first.");
    setSaving(true);
    const res = await saveTargetRoleAction({
      name: roleName,
      region: region || null,
      sourceJd: jd || null,
      competencies: comps.map((c) => ({ competencyId: c.competencyId, weight: c.weight, priority: c.priority, target: c.target })),
    });
    setSaving(false);
    if ("error" in res) return toast.error(res.error);
    toast.success(`Target role "${roleName.trim()}" saved - it's now selectable wherever roles are picked.`);
    setRoleName("");
    setJd("");
    setComps(null);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* 1) Role basics + JD */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#010131]">1. Describe the role</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Role name</span>
            <Input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Head of Data Governance"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Region (optional)</span>
            <select value={region} onChange={(e) => setRegion(e.target.value as Region)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">-</option>
              <option value="saudi">Saudi</option>
              <option value="uae">UAE</option>
              <option value="gcc">GCC</option>
              <option value="global">Global</option>
            </select>
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Job description</span>
          <Textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            rows={7}
            placeholder="Paste the job description (English or Arabic). The AI maps it to the VIFM competency framework."
          />
        </label>
        <button
          onClick={extract}
          disabled={extracting || jd.trim().length < 30}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50"
        >
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {extracting ? "Reading the JD…" : "Identify competencies from JD"}
        </button>
      </section>

      {/* 2) Extracted competencies (editable) */}
      {comps !== null && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#010131]">2. Review by domain, area and target</h2>
            <span className="text-xs text-muted-foreground">
              {count} competenc{count === 1 ? "y" : "ies"} · ~{count * 4} statements
            </span>
          </div>

          {/* Domain rollup */}
          {count > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rollup.map((d) => (
                <span key={d.domain} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${domainTw(d.domain)}`}>
                  {d.domain} · {d.n}
                </span>
              ))}
            </div>
          )}

          {count === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No competencies. Adjust the JD and extract again.</p>
          ) : (
            <div className="mt-3 space-y-5">
              {byDomain.map(({ domain, areas }) => (
                <div key={domain}>
                  <div className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold tracking-wide ${domainTw(domain)}`}>
                    {domain}
                  </div>
                  <div className="mt-2 space-y-4 border-l-2 border-slate-100 pl-3">
                    {areas.map(([area, list]) => (
                      <div key={area}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{area}</p>
                        <div className="mt-1.5 space-y-2">
                          {list.map((c) => (
                      <div key={c.competencyId} className="rounded-md border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111232]">{c.name}</p>
                            {c.reasoning && <p className="mt-0.5 text-xs text-muted-foreground">{c.reasoning}</p>}
                          </div>
                          <button onClick={() => remove(c.competencyId)} className="shrink-0 text-slate-400 hover:text-rose-600" title="Remove">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            Priority
                            <select
                              value={c.priority}
                              onChange={(e) => update(c.competencyId, { priority: e.target.value as DesignedCompetency["priority"] })}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-foreground"
                            >
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            Weight
                            <Input
                              type="number" min={0.5} max={10} step={0.5} value={c.weight}
                              onChange={(e) => update(c.competencyId, { weight: Number(e.target.value) })}
                              className="h-8 w-16 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            Target (1-5)
                            <Input
                              type="number" min={1} max={5} step={0.5} value={c.target}
                              onChange={(e) => update(c.competencyId, { target: Number(e.target.value) })}
                              className="h-8 w-16 px-2 py-1 text-xs"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || count === 0 || !roleName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#5391D5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save target role
            </button>
            {!roleName.trim() && <span className="text-xs text-amber-600">Add a role name above to save.</span>}
          </div>
        </section>
      )}

      {comps === null && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Saved roles are reusable everywhere a target role is picked (Persona hiring, vouchers, and the engagement wizard).
        </p>
      )}
    </div>
  );
}
