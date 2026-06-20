"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { setAssessmentTimerAction } from "../actions";

type Scope = "quiz" | "fluent" | "cognitive";

function TimerRow({
  scope,
  label,
  hint,
  initial,
}: {
  scope: Scope;
  label: string;
  hint: string;
  initial: number;
}) {
  const [value, setValue] = useState(String(initial));
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const minutes = Math.max(1, Math.min(600, Math.round(Number(value) || 0)));
      const res = await setAssessmentTimerAction(scope, minutes);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${label} timer saved (${minutes} min)`);
        setValue(String(minutes));
      }
    });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grow">
        <Label className="text-xs">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Input
        type="number"
        min={1}
        max={600}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24"
      />
      <span className="text-xs text-muted-foreground">min</span>
      <Button size="sm" disabled={pending} onClick={save}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Save
      </Button>
    </div>
  );
}

/** Admin editor for the type-level assessment timers (quiz + fluent + cognitive). */
export function TimerSettings({ quiz, fluent, cognitive }: { quiz: number; fluent: number; cognitive: number }) {
  return (
    <div className="space-y-5">
      <TimerRow scope="quiz" label="Candidate practice quiz" hint="Time limit for the self-serve AI quiz." initial={quiz} />
      <TimerRow scope="fluent" label="Fluent English placement" hint="Time limit for the four-skill placement test." initial={fluent} />
      <TimerRow scope="cognitive" label="Reason" hint="Time limit for the numerical / verbal / inductive / deductive reasoning test." initial={cognitive} />
      <p className="text-[11px] text-muted-foreground">
        ARC and Techno assessments are timed per assessment / per domain where they are configured. The Sandbox
        uses its own per-blueprint time.
      </p>
    </div>
  );
}
