"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardList, ArrowRight, AlertTriangle } from "lucide-react";
import { generateIdpAction } from "../actions";

type Labels = {
  generate: string;
  generating: string;
  open: string;
  noParticipant: string;
  error: string;
};

export function GenerateIdpButton({
  engagementId,
  candidateId,
  labels,
}: {
  engagementId: string;
  candidateId: string;
  labels: Labels;
}) {
  const [pending, start] = useTransition();
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [priorities, setPriorities] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);

  const run = () =>
    start(async () => {
      setMsg(null);
      const res = await generateIdpAction(engagementId, candidateId);
      if (res.ok) {
        setParticipantId(res.participantId);
        setPriorities(res.priorities);
        setMsg({ tone: "ok", text: res.reused ? "Existing plan kept (not overwritten)." : `Draft created with ${res.priorities} priorities.` });
      } else if (res.error === "no_participant") {
        setMsg({ tone: "warn", text: labels.noParticipant });
      } else {
        setMsg({ tone: "warn", text: res.message || labels.error });
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
          {pending ? labels.generating : labels.generate}
        </Button>
        {participantId && (
          <Link
            href={`/reflect/consultant/participants/${participantId}/idp`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5391D5] hover:underline"
          >
            {labels.open} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {msg && (
        <p
          className={`inline-flex items-center gap-1.5 text-xs ${
            msg.tone === "ok" ? "text-emerald-700" : msg.tone === "warn" ? "text-amber-700" : "text-rose-700"
          }`}
        >
          {msg.tone !== "ok" && <AlertTriangle className="h-3.5 w-3.5" />}
          {msg.text}
          {priorities != null && msg.tone === "ok" ? "" : ""}
        </p>
      )}
    </div>
  );
}
