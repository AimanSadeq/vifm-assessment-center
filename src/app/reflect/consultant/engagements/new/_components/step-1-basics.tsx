"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import type { WizardOrg, WizardState } from "./wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { createInlineReflectOrganisation } from "@/lib/reflect/actions";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  orgs: WizardOrg[];
  /** Callback so newly-created orgs propagate up to the wizard's prop list. */
  onOrgCreated: (org: WizardOrg) => void;
};

export function StepBasics({ state, update, orgs, onOrgCreated }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgNameAr, setNewOrgNameAr] = useState("");
  const [newOrgRegion, setNewOrgRegion] = useState<"uae" | "saudi">("uae");
  const [newOrgSector, setNewOrgSector] = useState<"government" | "banking" | "general">("banking");
  const [addError, setAddError] = useState<string | null>(null);
  const [addPending, startAddTransition] = useTransition();

  const submitNewOrg = () => {
    setAddError(null);
    startAddTransition(async () => {
      const res = await createInlineReflectOrganisation({
        name: newOrgName.trim(),
        name_ar: newOrgNameAr.trim() || "",
        region: newOrgRegion,
        sector: newOrgSector,
      });
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      onOrgCreated(res.org);
      update({
        organization_id: res.org.id,
        region: res.org.region,
        sector: res.org.sector,
      });
      setAddOpen(false);
      setNewOrgName("");
      setNewOrgNameAr("");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Engagement basics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Identify the client, name the engagement, and set field-work defaults. You can change most of these later from the engagement detail page.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="rf-name">Engagement name</Label>
          <Input
            id="rf-name"
            placeholder="e.g. Leadership 360 - Cohort 1"
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="rf-org">Client organisation</Label>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-[11px] text-accent hover:underline inline-flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> Add new
            </button>
          </div>
          <select
            id="rf-org"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.organization_id}
            onChange={(e) => {
              const id = e.target.value;
              const org = orgs.find((o) => o.id === id);
              update({
                organization_id: id,
                region: org?.region ?? state.region,
                sector: org?.sector ?? state.sector,
              });
            }}
          >
            <option value="">Select an organisation…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.region.toUpperCase()} · {o.sector}
              </option>
            ))}
          </select>
          {orgs.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              No organisations yet - click <strong>Add new</strong> above to create one.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="rf-target">Target participant count <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            id="rf-target"
            type="number"
            min={1}
            placeholder="117"
            value={state.participant_target_count ?? ""}
            onChange={(e) =>
              update({
                participant_target_count: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>

        <div>
          <Label htmlFor="rf-default-lang">Default language for raters</Label>
          <select
            id="rf-default-lang"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.default_language}
            onChange={(e) => update({ default_language: e.target.value as "en" | "ar" })}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>

        <div>
          <Label htmlFor="rf-report-lang">Report language</Label>
          <select
            id="rf-report-lang"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.report_language}
            onChange={(e) =>
              update({ report_language: e.target.value as "en" | "ar" | "bilingual" })
            }
          >
            <option value="bilingual">Bilingual (EN + AR)</option>
            <option value="en">English only</option>
            <option value="ar">Arabic only</option>
          </select>
        </div>

        <div>
          <Label htmlFor="rf-anon">Anonymity threshold N</Label>
          <Input
            id="rf-anon"
            type="number"
            min={3}
            max={10}
            value={state.anonymity_min_n}
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ anonymity_min_n: Number.isFinite(v) && v >= 3 ? v : 3 });
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Minimum 3 - anything lower can&apos;t be conducted anonymously. Peer and direct-report scores stay hidden until this many raters in the group have responded.
          </p>
        </div>

        <div>
          <Label htmlFor="rf-field-start">Field window start <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            id="rf-field-start"
            type="date"
            value={state.field_window_start}
            onChange={(e) => update({ field_window_start: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="rf-field-end">Field window end <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            id="rf-field-end"
            type="date"
            value={state.field_window_end}
            onChange={(e) => update({ field_window_end: e.target.value })}
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-2 rounded-md border bg-muted/30 p-3">
          <Checkbox
            id="rf-sandbox"
            checked={state.is_sandbox}
            onCheckedChange={(v) => update({ is_sandbox: Boolean(v) })}
          />
          <Label htmlFor="rf-sandbox" className="text-sm font-normal cursor-pointer">
            Sandbox engagement - invitations + reminders are redirected to the sandbox inbox
            and do not reach real raters. Use this for client demos and internal testing.
          </Label>
        </div>
      </div>

      {/* Add-new-org modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-card rounded-xl border p-6 max-w-md w-full space-y-4">
            <div>
              <h3 className="text-base font-semibold text-primary">Add a new organisation</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Stored in the shared client list - also available to AI Readiness engagements.
              </p>
            </div>

            <div>
              <Label htmlFor="rf-new-org-name">Name <span className="text-rose-700">*</span></Label>
              <Input
                id="rf-new-org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g. Acme Bank"
              />
            </div>

            <div>
              <Label htmlFor="rf-new-org-name-ar">Name (Arabic) <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="rf-new-org-name-ar"
                value={newOrgNameAr}
                onChange={(e) => setNewOrgNameAr(e.target.value)}
                dir="rtl"
                placeholder="بنك أكمي"
              />
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label htmlFor="rf-new-org-region">Region</Label>
                <select
                  id="rf-new-org-region"
                  value={newOrgRegion}
                  onChange={(e) => setNewOrgRegion(e.target.value as "uae" | "saudi")}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="uae">UAE</option>
                  <option value="saudi">Saudi Arabia</option>
                </select>
              </div>
              <div>
                <Label htmlFor="rf-new-org-sector">Sector</Label>
                <select
                  id="rf-new-org-sector"
                  value={newOrgSector}
                  onChange={(e) => setNewOrgSector(e.target.value as "government" | "banking" | "general")}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="banking">Banking</option>
                  <option value="government">Government</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            {addError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {addError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setAddOpen(false); setAddError(null); }}
                disabled={addPending}
                className="rounded-md border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <Button type="button" onClick={submitNewOrg} disabled={addPending || !newOrgName.trim()}>
                {addPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                Add organisation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
