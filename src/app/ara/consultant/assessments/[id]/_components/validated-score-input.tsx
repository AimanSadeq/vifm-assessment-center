"use client";

import { useRef, useTransition } from "react";
import { setConsultantValidatedScore } from "@/lib/ara/consultant-actions";

/**
 * Inline-editable validated-score input. Submits on blur (and on Enter).
 * Needs to be a client component because server-rendered <input> can't
 * carry event handlers in Next.js App Router.
 */
export function ValidatedScoreInput({
  assessmentId,
  pillarId,
  defaultValue,
}: {
  assessmentId: string;
  pillarId: string;
  defaultValue: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    const val = inputRef.current?.value.trim();
    if (!val) return;
    const fd = new FormData();
    fd.set("assessment_id", assessmentId);
    fd.set("pillar_id", pillarId);
    fd.set("consultant_validated_score", val);
    start(async () => {
      await setConsultantValidatedScore(fd);
    });
  };

  return (
    <input
      ref={inputRef}
      type="number"
      min="1"
      max="5"
      step="0.1"
      defaultValue={defaultValue ?? ""}
      disabled={pending}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
      className="w-16 h-7 rounded border border-input bg-background px-2 text-xs text-right tabular-nums disabled:opacity-60"
      placeholder="-"
    />
  );
}
