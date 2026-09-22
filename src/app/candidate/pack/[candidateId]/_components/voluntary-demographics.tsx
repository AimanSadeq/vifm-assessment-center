"use client";

/**
 * Voluntary self-identification (BPS 3.19).
 *
 * Deliberately modelled on the Pre-Hire version: it sits apart from anything
 * that affects a result, "prefer not to say" is a first-class answer on every
 * question rather than an absence, and the wording says plainly what it is for.
 * A participant who suspects this feeds their score will either skip it or
 * answer strategically, and either way the monitoring data becomes worthless.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setVoluntaryDemographicsAction } from "../actions";

const GENDER = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const AGE = [
  { value: "under_25", label: "Under 25" },
  { value: "25_34", label: "25-34" },
  { value: "35_44", label: "35-44" },
  { value: "45_54", label: "45-54" },
  { value: "55_plus", label: "55+" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const NATIONALITY = [
  { value: "national", label: "National / citizen" },
  { value: "expatriate", label: "Expatriate / resident" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function VoluntaryDemographics({
  candidateId,
  gender,
  ageBand,
  nationalityGroup,
  submittedAt,
}: {
  candidateId: string;
  gender: string;
  ageBand: string;
  nationalityGroup: string;
  submittedAt: string | null;
}) {
  const router = useRouter();
  const [g, setG] = useState(gender);
  const [a, setA] = useState(ageBand);
  const [n, setN] = useState(nationalityGroup);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(Boolean(submittedAt));

  const save = async () => {
    setBusy(true);
    const res = await setVoluntaryDemographicsAction({
      candidateId,
      gender: g || null,
      ageBand: a || null,
      nationalityGroup: n || null,
    });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That could not be saved.");
      return;
    }
    setDone(true);
    toast.success("Thank you.");
    router.refresh();
  };

  const Row = ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={value === o.value ? "default" : "outline"}
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? "" : o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">About you (optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          We check whether our assessments work equally well for everyone. Answering helps us do that. It is
          entirely optional, it is never used in your assessment or seen by anyone deciding about you, and it is
          only ever reported as group totals - never against your name.
        </p>
        <Row label="Gender" options={GENDER} value={g} onChange={setG} />
        <Row label="Age" options={AGE} value={a} onChange={setA} />
        <Row label="Nationality" options={NATIONALITY} value={n} onChange={setN} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={save} disabled={busy}>
            {done ? "Update" : "Save"}
          </Button>
          {done && <span className="text-xs text-muted-foreground">Thank you - saved.</span>}
        </div>
      </CardContent>
    </Card>
  );
}
