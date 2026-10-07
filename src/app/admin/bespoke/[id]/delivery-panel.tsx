"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, Unlock, Users, Upload, Trash2, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BundleSettings, DemographicField } from "@/lib/bespoke/bundle-settings";
import type { RosterRow } from "@/lib/bespoke/roster";
import {
  saveBundleDeliveryAction,
  setBundleHoldAction,
  importRosterAction,
  removeRosterEntryAction,
} from "./delivery-actions";

// One field per line: "Label | option; option" is a pick-list, "Label" alone is free text.
function fieldsToText(fields: DemographicField[]): string {
  return fields.map((f) => (f.type === "select" ? `${f.label} | ${(f.options ?? []).join("; ")}` : f.label)).join("\n");
}
function textToFields(text: string): DemographicField[] {
  const used = new Set<string>();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, opts] = line.split("|").map((x) => x.trim());
      let key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 36) || "field";
      if (!/^[a-z]/.test(key)) key = `f_${key}`;
      while (used.has(key)) key = `${key}_2`;
      used.add(key);
      const options = (opts ?? "").split(";").map((o) => o.trim()).filter(Boolean);
      return options.length >= 2
        ? { key, label, type: "select" as const, options, required: true }
        : { key, label, type: "text" as const, required: true };
    });
}

export type RosterView = RosterRow & { status: "not_started" | "invited" | "in_progress" | "completed" };

const STATUS_LABEL: Record<RosterView["status"], string> = {
  not_started: "Not started",
  invited: "Started",
  in_progress: "In progress",
  completed: "Completed",
};

export function DeliveryPanel({
  bundleId,
  settings,
  roster,
}: {
  bundleId: string;
  settings: BundleSettings;
  roster: RosterView[];
}) {
  const [pending, start] = useTransition();
  const [rosterRequired, setRosterRequired] = useState(settings.rosterRequired);
  const [welcome, setWelcome] = useState(settings.welcomeMessage ?? "");
  const [fieldsText, setFieldsText] = useState(fieldsToText(settings.demographicFields));
  const [minutes, setMinutes] = useState(settings.logicaMinutes ? String(settings.logicaMinutes) : "");
  const [paste, setPaste] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const completed = roster.filter((r) => r.status === "completed").length;
  const startedCount = roster.filter((r) => r.status !== "not_started").length;
  const testers = roster.filter((r) => r.is_tester).length;

  const run = (fn: () => Promise<{ ok: true } | { error: string }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      if ("error" in res) toast.error(res.error);
      else toast.success(okMsg);
    });

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4 text-[#5391D5]" /> Delivery controls
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Who may sit, when the assessment opens, and what candidates see before they start.
          </p>
        </div>
        {settings.held ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <Lock className="h-3.5 w-3.5" /> On hold: closed to candidates{testers ? ` (${testers} tester${testers === 1 ? "" : "s"} can sit)` : ""}
            </span>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Open this assessment to candidates now? Only do this after the client's green light.")) return;
                run(() => setBundleHoldAction(bundleId, false), "Assessment released to candidates.");
              }}
            >
              <Unlock className="mr-1 h-4 w-4" /> Release
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <Unlock className="h-3.5 w-3.5" /> Open{settings.releasedAt ? ` since ${new Date(settings.releasedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setBundleHoldAction(bundleId, true), "Assessment put on hold.")}>
              <Lock className="mr-1 h-4 w-4" /> Put on hold
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={rosterRequired} onChange={(e) => setRosterRequired(e.target.checked)} />
            <span>
              <span className="font-medium">Approved list only</span>
              <span className="block text-xs text-muted-foreground">
                The shared link accepts only emails on the roster below, one sitting each. A returning person resumes their own sitting.
              </span>
            </span>
          </label>
          <div>
            <div className="text-sm font-medium">Reasoning time limit (minutes)</div>
            <Input className="mt-1 w-32" inputMode="numeric" value={minutes} placeholder="Default" onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))} />
            <p className="mt-1 text-xs text-muted-foreground">Leave empty to use the platform default. Enforced by the server.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">Welcome message</div>
            <Textarea className="mt-1" rows={4} value={welcome} onChange={(e) => setWelcome(e.target.value)} placeholder="Shown on the first screen, above the consent." />
          </div>
          <div>
            <div className="text-sm font-medium">Demographic questions</div>
            <Textarea
              className="mt-1 font-mono text-xs"
              rows={4}
              value={fieldsText}
              onChange={(e) => setFieldsText(e.target.value)}
              placeholder={"One per line, all required:\nGender | Male; Female\nYears with the organisation | Less than 2; 2 to 5; More than 5\nCity"}
            />
            <p className="mt-1 text-xs text-muted-foreground">&quot;Label | option; option&quot; makes a pick-list; a label alone is free text.</p>
          </div>
        </div>
      </div>
      <Button
        className="mt-3"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(
            () =>
              saveBundleDeliveryAction(bundleId, {
                rosterRequired,
                welcomeMessage: welcome,
                demographicFields: textToFields(fieldsText),
                logicaMinutes: minutes ? Number(minutes) : null,
              }),
            "Delivery settings saved.",
          )
        }
      >
        {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save settings
      </Button>

      <div className="mt-6 border-t pt-4">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-[#5391D5]" /> Roster ({roster.length}) · {startedCount} started · {completed} completed
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste from Excel with a header row. Needs Email and Name columns; Grade, Position, Business Unit, Employee ID (or Person) and Tester (yes/no) are
          read when present; other columns are kept as extra details. Re-pasting updates people by email and never removes anyone.
        </p>
        <Textarea className="mt-2 font-mono text-xs" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Email\tName\tGrade\tPosition\tBusiness Unit\tEmployee ID"} />
        <Button
          className="mt-2"
          size="sm"
          variant="outline"
          disabled={pending || !paste.trim()}
          onClick={() =>
            start(async () => {
              const res = await importRosterAction(bundleId, paste);
              if ("error" in res) {
                toast.error(res.error);
                setImportErrors(res.errors ?? []);
              } else {
                toast.success(`Imported ${res.count} people.`);
                setImportErrors([]);
                setPaste("");
              }
            })
          }
        >
          <Upload className="mr-1 h-4 w-4" /> Import roster
        </Button>
        {importErrors.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-rose-700">
            {importErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        {roster.length > 0 && (
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Email</th>
                  <th className="px-2 py-1.5">Grade</th>
                  <th className="px-2 py-1.5">Business unit</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1.5">
                      {r.full_name}
                      {r.is_tester && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-800">tester</span>}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.email_norm}</td>
                    <td className="px-2 py-1.5">{r.grade ?? "-"}</td>
                    <td className="px-2 py-1.5">{r.business_unit ?? "-"}</td>
                    <td className="px-2 py-1.5">{STATUS_LABEL[r.status]}</td>
                    <td className="px-2 py-1.5 text-right">
                      {r.status === "not_started" && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-rose-600"
                          title="Remove from roster"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm(`Remove ${r.full_name} from the roster?`)) return;
                            run(() => removeRosterEntryAction(bundleId, r.id), "Removed.");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
