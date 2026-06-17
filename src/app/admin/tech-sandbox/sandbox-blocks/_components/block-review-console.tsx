"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ReviewPillar } from "@/lib/technical-sandbox/service";
import { setBlockReviewStatusAction } from "../actions";

const STATUSES = ["approved", "in_review", "rejected", "retired", "draft"] as const;
type ReviewStatus = (typeof STATUSES)[number];

const reviewClass = (s: string) =>
  s === "approved"
    ? "bg-emerald-100 text-emerald-800"
    : s === "rejected" || s === "retired"
      ? "bg-rose-100 text-rose-800"
      : s === "in_review"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

export function BlockReviewConsole({ pillars }: { pillars: ReviewPillar[] }) {
  const [pending, start] = useTransition();

  if (pillars.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No sandbox tasks for this function (or migration 00120 has not been applied yet).
      </p>
    );
  }

  const setStatus = (blockId: string, status: ReviewStatus) =>
    start(async () => {
      const res = await setBlockReviewStatusAction(blockId, status);
      if (res.ok) toast.success("Review status updated");
      else toast.error(res.error ?? "Update failed");
    });

  return (
    <div className="space-y-4">
      {pillars.map((p) => {
        const approved = p.blocks.filter((b) => b.reviewStatus === "approved").length;
        return (
          <div key={p.pillarId} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-[#010131]">{p.pillarName}</h3>
              <span className="text-xs text-muted-foreground">
                {approved}/{p.blocks.length} approved
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {p.blocks.map((b) => (
                <div key={b.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#121232]">{b.nameEn}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {b.engineType}
                        {b.status !== "active" ? " · inactive" : ""}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${reviewClass(b.reviewStatus)}`}>
                        {b.reviewStatus}
                      </span>
                      {b.reviewerName ? (
                        <span className="text-[10px] text-muted-foreground">{b.reviewerName}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={pending || b.reviewStatus === s}
                        onClick={() => setStatus(b.id, s)}
                        className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
