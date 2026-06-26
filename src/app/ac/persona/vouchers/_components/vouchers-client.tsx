"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, GraduationCap } from "lucide-react";
import { AdminVoucherIssuer, type AdminVoucherRow } from "@/components/shared/admin-voucher-issuer";
import {
  generatePersonaVouchersAction,
  disablePersonaVoucherAction,
  emailVoucherDelegatesAction,
  emailExistingVoucherCodeAction,
} from "../actions";

export type PersonaVoucherRow = AdminVoucherRow & { default_language: "en" | "ar" };

type RoleOption = { id: string; name: string; competencyIds: string[] };
type CompetencyOption = { id: string; name: string; clusterOrder: number; clusterName: string };

// Thin wrapper over the shared admin voucher issuer (consolidation - admin side).
// Persona's per-service options: project label + language (inline) and a full
// scope panel (purpose, question format, target role, competency coverage).
export function VouchersClient({
  vouchers,
  clients,
  roleOptions = [],
  personaCompetencies = [],
}: {
  vouchers: PersonaVoucherRow[];
  clients: string[];
  roleOptions?: RoleOption[];
  personaCompetencies?: CompetencyOption[];
}) {
  const [projectLabel, setProjectLabel] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");

  const allCompIds = useMemo(() => personaCompetencies.map((c) => c.id), [personaCompetencies]);
  const [purpose, setPurpose] = useState<"hiring" | "development">("hiring");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [selectedComps, setSelectedComps] = useState<Set<string>>(() => new Set(allCompIds));
  const [itemFormat, setItemFormat] = useState<"normative" | "ipsative" | "both">("both");

  const compsByCluster = useMemo(() => {
    const m = new Map<number, { name: string; comps: CompetencyOption[] }>();
    for (const c of personaCompetencies) {
      if (!m.has(c.clusterOrder)) m.set(c.clusterOrder, { name: c.clusterName, comps: [] });
      m.get(c.clusterOrder)!.comps.push(c);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [personaCompetencies]);

  const total = allCompIds.length;
  const selectedCount = selectedComps.size;
  const isFull = selectedCount === total;
  const estItems = selectedCount * 4;

  const onRoleChange = (roleId: string) => {
    setTargetRoleId(roleId);
    const role = roleOptions.find((r) => r.id === roleId);
    if (role) {
      const allowed = new Set(allCompIds);
      const pre = role.competencyIds.filter((id) => allowed.has(id));
      setSelectedComps(new Set(pre.length > 0 ? pre : allCompIds));
    }
  };

  const toggleComp = (id: string) =>
    setSelectedComps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const scope = () => ({
    purpose,
    targetRoleProfileId: purpose === "hiring" ? targetRoleId || null : null,
    scopedCompetencyIds: isFull || selectedComps.size === 0 ? [] : [...selectedComps],
    itemFormat,
  });
  const validate = (): string | null =>
    purpose === "hiring" && !targetRoleId ? "Pick a target role profile for a hiring assessment." : null;

  return (
    <AdminVoucherIssuer
      redeemPath="/ac/persona/redeem"
      clients={clients}
      vouchers={vouchers}
      optionsLabel="Persona"
      options={
        <>
          <div className="flex-1 min-w-[12rem] space-y-1.5">
            <Label className="text-xs">Project / cohort (optional)</Label>
            <Input value={projectLabel} onChange={(e) => setProjectLabel(e.target.value)} placeholder="Groups with Logica for reporting" />
          </div>
          <div className="w-32 space-y-1.5">
            <Label className="text-xs">Language</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value === "ar" ? "ar" : "en")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </>
      }
      optionsBlock={
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <div>
            <Label className="text-xs">Assessment purpose</Label>
            <div className="mt-1.5 inline-flex rounded-lg border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => setPurpose("hiring")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${purpose === "hiring" ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <Target className="h-3.5 w-3.5" /> Hiring / selection
              </button>
              <button
                type="button"
                onClick={() => setPurpose("development")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${purpose === "development" ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Development
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Question format</Label>
            <div className="mt-1.5 inline-flex flex-wrap gap-1.5">
              {([
                ["both", "Both (recommended)"],
                ["normative", "Rating only"],
                ["ipsative", "Most / least only"],
              ] as ["normative" | "ipsative" | "both", string][]).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setItemFormat(val)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${itemFormat === val ? "border-[#5391D5] bg-[#5391D5] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {purpose === "hiring" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Target role (required - the fit is computed against it)</Label>
              {roleOptions.length > 0 ? (
                <select
                  value={targetRoleId}
                  onChange={(e) => onRoleChange(e.target.value)}
                  className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a role profile…</option>
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-600">
                  No role profiles yet. Create one under Admin -&gt; Role Profiles to scope a hiring assessment.
                </p>
              )}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs">
                Competency coverage
                {purpose === "hiring" && targetRoleId ? " (defaults to the role's competencies)" : ""}
              </Label>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" className="text-[#5391D5] hover:underline" onClick={() => setSelectedComps(new Set(allCompIds))}>
                  Full profile (all {total})
                </button>
                <span className="text-slate-300">|</span>
                <button type="button" className="text-[#5391D5] hover:underline" onClick={() => setSelectedComps(new Set())}>
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
              {compsByCluster.map((cl) => (
                <div key={cl.name}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{cl.name}</p>
                  <div className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {cl.comps.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedComps.has(c.id)}
                          onChange={() => toggleComp(c.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        <span className="text-foreground">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {isFull || selectedCount === 0
                ? `Full profile - all ${total} competencies. The candidate answers the whole bank (leave as-is for a general link).`
                : `${selectedCount} of ${total} competencies (~${estItems} statements). The candidate answers only these.`}
            </p>
          </div>
        </div>
      }
      onGenerate={async (c) => {
        const err = validate();
        if (err) return { error: err };
        const res = await generatePersonaVouchersAction({
          count: c.count,
          label: c.label || undefined,
          clientName: c.clientName || undefined,
          projectLabel: projectLabel || undefined,
          maxUses: c.maxUses,
          expiresAt: c.expiresAt,
          ...scope(),
        });
        return "error" in res ? { error: res.error } : { codes: res.codes };
      }}
      onDisable={async (id) => {
        const res = await disablePersonaVoucherAction(id);
        return "error" in res ? { error: res.error } : { ok: true };
      }}
      onEmailDelegates={async ({ delegates, common }) => {
        const err = validate();
        if (err) return { error: err };
        const res = await emailVoucherDelegatesAction({
          delegates,
          label: common.label || undefined,
          clientName: common.clientName || undefined,
          projectLabel: projectLabel || undefined,
          language,
          expiresAt: common.expiresAt,
          ...scope(),
        });
        if ("error" in res) return { error: res.error };
        return { results: res.results.map((r) => ({ email: r.email, ok: r.ok, error: r.error })) };
      }}
      onEmailRow={async (code) => {
        const email = window.prompt("Email this code to which address?");
        if (!email) return;
        const res = await emailExistingVoucherCodeAction({ code, email, language });
        if ("error" in res) toast.error(res.error);
        else toast.success(`Sent to ${email.trim()}.`);
      }}
    />
  );
}
