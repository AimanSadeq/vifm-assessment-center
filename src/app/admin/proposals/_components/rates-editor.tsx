"use client";

import { useState } from "react";
import { setRateAction } from "../actions";

type Row = { serviceKey: string; label: string; unitRate: number; currency: string };

export function RatesEditor({ rows }: { rows: Row[] }) {
  const [state, setState] = useState<Record<string, { unitRate: number; currency: string }>>(
    Object.fromEntries(rows.map((r) => [r.serviceKey, { unitRate: r.unitRate, currency: r.currency }])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(serviceKey: string) {
    setSaving(serviceKey);
    setSaved(null);
    const s = state[serviceKey];
    const res = await setRateAction({ serviceKey, unitRate: s.unitRate, currency: s.currency });
    setSaving(null);
    if (!("error" in res)) {
      setSaved(serviceKey);
      setTimeout(() => setSaved((k) => (k === serviceKey ? null : k)), 1500);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        Set the per-participant rate for each service. Proposals price at participants × this rate. Rates are stored as a
        snapshot on each proposal, so changing them here never alters an already-created proposal.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.serviceKey} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
            <span className="min-w-[8rem] text-sm font-medium text-foreground">{r.label}</span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Rate / participant
              <input type="number" min={0} step="1" value={state[r.serviceKey].unitRate}
                onChange={(e) => setState((p) => ({ ...p, [r.serviceKey]: { ...p[r.serviceKey], unitRate: Math.max(0, Number(e.target.value) || 0) } }))}
                className="w-28 rounded border border-border px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Currency
              <select value={state[r.serviceKey].currency}
                onChange={(e) => setState((p) => ({ ...p, [r.serviceKey]: { ...p[r.serviceKey], currency: e.target.value } }))}
                className="rounded border border-border px-2 py-1 text-sm">
                <option>USD</option><option>AED</option><option>SAR</option><option>EUR</option><option>GBP</option>
              </select>
            </label>
            <button onClick={() => save(r.serviceKey)} disabled={saving === r.serviceKey}
              className="ml-auto rounded-md bg-[#010131] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#121140] disabled:opacity-50">
              {saving === r.serviceKey ? "Saving…" : saved === r.serviceKey ? "Saved" : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
