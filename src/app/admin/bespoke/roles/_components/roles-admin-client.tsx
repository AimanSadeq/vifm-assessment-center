"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, FolderPlus, Boxes, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createJobFamilyAction, createRoleAction } from "../actions";

type Family = { id: string; name_en: string; name_ar: string | null };
type Role = {
  id: string; name_en: string; job_family_id: string | null; status: string;
  persona_pass_pct: number; technical_pass_pct: number; is_sample: boolean;
};

export function RolesAdminClient({ families, roles }: { families: Family[]; roles: Role[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [famName, setFamName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleFamily, setRoleFamily] = useState("");
  const [personaPct, setPersonaPct] = useState(60);
  const [techPct, setTechPct] = useState(60);

  const addFamily = () =>
    start(async () => {
      const res = await createJobFamilyAction({ nameEn: famName });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Job family created");
      setFamName("");
      router.refresh();
    });

  const addRole = () =>
    start(async () => {
      const res = await createRoleAction({
        jobFamilyId: roleFamily || null,
        nameEn: roleName,
        personaPassPct: personaPct,
        technicalPassPct: techPct,
      });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Role created");
      if ("id" in res && res.id) router.push(`/admin/bespoke/roles/${res.id}`);
    });

  const rolesByFamily = (famId: string | null) => roles.filter((r) => r.job_family_id === famId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      {/* Create forms */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><FolderPlus className="h-4 w-4 text-[#5391D5]" /> New job family</h2>
          <div className="mt-3 flex gap-2">
            <Input value={famName} onChange={(e) => setFamName(e.target.value)} placeholder="e.g. Human Resources" />
            <Button onClick={addFamily} disabled={pending || famName.trim().length < 2} size="sm">Add</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Plus className="h-4 w-4 text-[#5391D5]" /> New role</h2>
          <div className="mt-3 space-y-2">
            <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Role name, e.g. HR General Manager" />
            <div>
              <Label className="text-xs">Job family</Label>
              <select value={roleFamily} onChange={(e) => setRoleFamily(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">(none)</option>
                {families.map((f) => <option key={f.id} value={f.id}>{f.name_en}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <label className="flex-1 text-xs">Persona pass %
                <Input type="number" min={0} max={100} value={personaPct} onChange={(e) => setPersonaPct(Number(e.target.value) || 0)} className="mt-1" />
              </label>
              <label className="flex-1 text-xs">Technical pass %
                <Input type="number" min={0} max={100} value={techPct} onChange={(e) => setTechPct(Number(e.target.value) || 0)} className="mt-1" />
              </label>
            </div>
            <Button onClick={addRole} disabled={pending || roleName.trim().length < 2} className="w-full gap-1.5">
              <Plus className="h-4 w-4" /> Create role + open editor
            </Button>
          </div>
        </div>
      </div>

      {/* Roles list grouped by family */}
      <div className="space-y-4">
        {[...families, { id: "__none__", name_en: "Ungrouped", name_ar: null }].map((fam) => {
          const famId = fam.id === "__none__" ? null : fam.id;
          const list = rolesByFamily(famId);
          if (list.length === 0 && fam.id === "__none__") return null;
          return (
            <div key={fam.id} className="rounded-xl border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fam.name_en}</div>
              {list.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No roles yet.</p>
              ) : (
                <ul className="mt-2 divide-y">
                  {list.map((r) => (
                    <li key={r.id}>
                      <Link href={`/admin/bespoke/roles/${r.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-muted/40">
                        <span className="inline-flex items-center gap-2 text-sm font-medium">
                          <Boxes className="h-4 w-4 text-[#5391D5]" /> {r.name_en}
                          {r.is_sample && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">SAMPLE</span>}
                        </span>
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                          P{r.persona_pass_pct}/T{r.technical_pass_pct}
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {roles.length === 0 && <p className="text-sm text-muted-foreground">No roles configured yet. Create a job family, then a role.</p>}
      </div>
    </div>
  );
}
