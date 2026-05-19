"use client";

import type { WizardOrg, WizardState } from "./wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  orgs: WizardOrg[];
};

export function StepBasics({ state, update, orgs }: Props) {
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
            placeholder="e.g. Leadership 360 — Cohort 1"
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="rf-org">Client organisation</Label>
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
              No organisations yet. Create one in the AI Readiness admin first — Reflect reuses the same client list.
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
            min={1}
            max={10}
            value={state.anonymity_min_n}
            onChange={(e) => update({ anonymity_min_n: Number(e.target.value) || 3 })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Industry standard is 3. Peer and direct-report scores hide until this many raters in the group have responded.
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
            Sandbox engagement — invitations + reminders are redirected to the sandbox inbox
            and do not reach real raters. Use this for client demos and internal testing.
          </Label>
        </div>
      </div>
    </div>
  );
}
