"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { raiseConcernAction } from "../actions";

const KINDS = [
  { value: "concern", label: "A concern", hint: "About how the assessment was arranged or run" },
  { value: "appeal", label: "An appeal", hint: "You believe a result is wrong" },
] as const;

const STAGES = [
  { value: "before", label: "Before the centre" },
  { value: "during", label: "During the centre" },
  { value: "after", label: "After the centre" },
] as const;

export function RaiseConcernForm({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"concern" | "appeal">("concern");
  const [stage, setStage] = useState<"before" | "during" | "after">("during");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await raiseConcernAction({ candidateId, kind, stage, body });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That could not be sent.");
      return;
    }
    toast.success("Sent. It has gone to the assessment team and you will be told when there is an answer.");
    setBody("");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Raise something</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button
              key={k.value}
              size="sm"
              variant={kind === k.value ? "default" : "outline"}
              onClick={() => setKind(k.value)}
              title={k.hint}
            >
              {k.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{KINDS.find((k) => k.value === kind)?.hint}</p>

        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={stage === s.value ? "secondary" : "outline"}
              onClick={() => setStage(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <Textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            kind === "appeal"
              ? "Which result do you believe is wrong, and why? Anything you can point to helps."
              : "What happened, and when? Anything that you think affected your assessment is worth saying."
          }
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Raising this does not change your results. It is read by the assessment team, not by your employer.
          </p>
          <Button onClick={submit} disabled={busy || body.trim().length < 15}>
            {busy ? "Sending..." : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
