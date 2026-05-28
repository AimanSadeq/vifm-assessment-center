"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  purgeReflectSandboxEngagements,
  purgeReflectArchivedEngagements,
} from "@/lib/reflect/admin-actions";

type Props = {
  variant: "sandbox" | "retention";
  count: number;
};

// The confirmation phrases are typed verbatim by the user, so they are NOT
// translated. Translatable labels are resolved per-variant via i18n below.
const CONFIRM_PHRASE = {
  sandbox: "DELETE SANDBOX DATA",
  retention: "DELETE OLD ENGAGEMENTS",
} as const;

export function ReflectAdminPurgeButtons({ variant, count }: Props) {
  const { t } = useTranslation();
  const confirmPhrase = CONFIRM_PHRASE[variant];
  const actionLabel = t(`reflectAdmin.purge.${variant}.actionLabel`);
  const disabledReason = t(`reflectAdmin.purge.${variant}.disabledReason`);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setFeedback(null);
    startTransition(async () => {
      const res =
        variant === "sandbox"
          ? await purgeReflectSandboxEngagements(confirmation)
          : await purgeReflectArchivedEngagements({ confirmation });
      if (!res.ok) {
        setFeedback({ kind: "err", text: res.error });
        return;
      }
      setFeedback({
        kind: "ok",
        text: t(`reflectAdmin.purge.${variant}.success`, { count: res.deleted }),
      });
      setOpen(false);
      setConfirmation("");
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={count === 0}
        onClick={() => setOpen(true)}
        className="text-xs"
        title={count === 0 ? disabledReason : actionLabel}
      >
        <AlertTriangle className="h-3.5 w-3.5 me-1.5 text-rose-600" />
        {actionLabel}
      </Button>

      {feedback?.kind === "ok" && (
        <span className="ms-2 inline-flex items-center gap-1 text-[11px] text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> {feedback.text}
        </span>
      )}
      {feedback?.kind === "err" && (
        <span className="ms-2 inline-flex items-center gap-1 text-[11px] text-rose-700">
          <AlertTriangle className="h-3 w-3" /> {feedback.text}
        </span>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-card rounded-xl border p-6 max-w-md w-full space-y-4">
            <div>
              <h3 className="text-base font-semibold text-primary">
                {actionLabel}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  count === 1
                    ? "reflectAdmin.purge.modalBody_one"
                    : "reflectAdmin.purge.modalBody_other",
                  { count }
                )}
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                {t("reflectAdmin.purge.confirmLabelBefore")} <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{confirmPhrase}</code> {t("reflectAdmin.purge.confirmLabelAfter")}
              </label>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={confirmPhrase}
                className="mt-1 font-mono text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setConfirmation(""); setFeedback(null); }}
                disabled={pending}
                className="rounded-md border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                {t("reflectAdmin.purge.cancel")}
              </button>
              <Button
                type="button"
                variant="destructive"
                onClick={run}
                disabled={pending || confirmation !== confirmPhrase}
              >
                {pending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {t("reflectAdmin.purge.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
