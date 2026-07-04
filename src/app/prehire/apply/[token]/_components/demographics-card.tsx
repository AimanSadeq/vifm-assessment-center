"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Voluntary equal-opportunity self-identification, shown after consent and
 * BEFORE the assessment so it's visibly decoupled from scoring. Every field is
 * optional; "Skip" and "prefer not to say" are first-class. Used by VIFM only in
 * aggregate to monitor fairness (the 4/5ths rule) - never per-individual, never
 * by assessors, never in the score.
 */

type Opt = { value: string; label: string };
const GENDERS: Opt[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const AGE_BANDS: Opt[] = [
  { value: "under_25", label: "Under 25" },
  { value: "25_34", label: "25–34" },
  { value: "35_44", label: "35–44" },
  { value: "45_54", label: "45–54" },
  { value: "55_plus", label: "55 or older" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const NATIONALITY: Opt[] = [
  { value: "national", label: "National / citizen" },
  { value: "expatriate", label: "Expatriate / resident" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Opt[] }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
      >
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function DemographicsCard({ token, onDone }: { token: string; onDone: () => void }) {
  const [gender, setGender] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [nationality, setNationality] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (body: Record<string, string>) => {
    setBusy(true);
    try {
      await fetch(`/api/prehire/${token}/demographics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* optional step - never block on failure */
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-semibold text-[#010131]">Optional: equal-opportunity monitoring</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is completely voluntary and is <strong>never</strong> used in your assessment or
            seen by the people reviewing it. VIFM uses it only in aggregate to check the screening
            is fair to everyone. We ask it now, before you begin, purely for administrative reasons -
            it <strong>cannot</strong> influence your result. You can skip it.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Gender" value={gender} onChange={setGender} options={GENDERS} />
          <Field label="Age" value={ageBand} onChange={setAgeBand} options={AGE_BANDS} />
          <Field label="Nationality" value={nationality} onChange={setNationality} options={NATIONALITY} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => send({ gender, age_band: ageBand, nationality_group: nationality })}
            disabled={busy}
          >
            {busy ? "Saving…" : "Submit"}
          </Button>
          <Button variant="ghost" onClick={() => send({})} disabled={busy}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
