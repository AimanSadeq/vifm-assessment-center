"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setFluentProctoringPolicyAction } from "../actions";

export function ProctoringToggle({
  orgParam,
  initialEnabled,
}: {
  orgParam: string | null;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    startTransition(async () => {
      const res = await setFluentProctoringPolicyAction({ orgParam, enabled: next });
      if (!res.ok) {
        setEnabled(!next);
        toast.error(res.error);
        return;
      }
      toast.success(
        next
          ? "Camera proctoring is now required on all your Fluent sittings."
          : "Camera proctoring is no longer required (per-voucher settings still apply)."
      );
    });
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={enabled}
      className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-muted/50 disabled:opacity-60"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-[#5391D5]" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-[#010131]">
        Require camera proctoring for our Fluent sittings
      </span>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </button>
  );
}
