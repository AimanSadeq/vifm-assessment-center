"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateCourseQuoteRequest } from "@/lib/courses/quote-request-actions";
import type { VifmCourseQuoteRequestStatus } from "@/types/database";

const STATUS_VALUES: VifmCourseQuoteRequestStatus[] = [
  "new", "contacted", "quoted", "won", "lost",
];

export function QuoteRequestActionsPanel({
  id,
  initialStatus,
  initialNotes,
}: {
  id: string;
  initialStatus: VifmCourseQuoteRequestStatus;
  initialNotes: string;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await updateCourseQuoteRequest({
        id,
        status,
        internal_notes: notes,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="status" className="text-xs">{t("adminCourses.quoteActions.pipelineStatus")}</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as VifmCourseQuoteRequestStatus)}
          disabled={pending}
          className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>{t(`adminCourses.quotes.status.${v}`)}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1">
          {t("adminCourses.quoteActions.statusHint")}
        </p>
      </div>

      <div>
        <Label htmlFor="internal_notes" className="text-xs">{t("adminCourses.quoteDetail.internalNotes")}</Label>
        <textarea
          id="internal_notes"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          placeholder={t("adminCourses.quoteActions.notesPlaceholder")}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending} size="sm">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />}
          {pending ? t("adminCourses.quoteActions.saving") : t("adminCourses.save")}
        </Button>
        {savedAt && !pending && (
          <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> {t("adminCourses.quoteActions.saved")}
          </span>
        )}
      </div>
    </div>
  );
}
