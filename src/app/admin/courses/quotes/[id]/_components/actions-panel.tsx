"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateCourseQuoteRequest } from "@/lib/courses/quote-request-actions";
import type { VifmCourseQuoteRequestStatus } from "@/types/database";

const STATUS_OPTIONS: Array<{ value: VifmCourseQuoteRequestStatus; label: string }> = [
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted",    label: "Quoted" },
  { value: "won",       label: "Won" },
  { value: "lost",      label: "Lost" },
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
        <Label htmlFor="status" className="text-xs">Pipeline status</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as VifmCourseQuoteRequestStatus)}
          disabled={pending}
          className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1">
          Moving to <em>contacted</em>, <em>quoted</em>, <em>won</em> or <em>lost</em> stamps the
          corresponding timeline timestamp.
        </p>
      </div>

      <div>
        <Label htmlFor="internal_notes" className="text-xs">Internal notes</Label>
        <textarea
          id="internal_notes"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          placeholder="e.g. Phoned 2026-04-30 — wants Q3 pricing, group of 18, hybrid delivery, in EN."
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
          {pending ? "Saving…" : "Save"}
        </Button>
        {savedAt && !pending && (
          <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
