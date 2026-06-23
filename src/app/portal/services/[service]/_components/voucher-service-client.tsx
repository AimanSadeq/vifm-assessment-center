"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Loader2, Copy, Link2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clientIssueVouchersAction,
  clientIssuePoolVoucherAction,
  type ClientIssueResult,
  type ClientPoolIssueResult,
} from "../actions";

type Issued = Extract<ClientIssueResult, { ok: true }>;
type PoolIssued = Extract<ClientPoolIssueResult, { ok: true }>;
type Mode = "individual" | "pool";

export function VoucherServiceClient({
  service,
  orgParam,
  hasAllocation,
  remaining,
}: {
  service: string;
  orgParam?: string;
  hasAllocation: boolean;
  remaining: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>("individual");
  const [text, setText] = useState("");
  const [seats, setSeats] = useState(10);
  const [result, setResult] = useState<Issued | null>(null);
  const [poolResult, setPoolResult] = useState<PoolIssued | null>(null);

  const issue = () =>
    start(async () => {
      const res = await clientIssueVouchersAction({ service, orgParam, delegatesText: text });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      setText("");
      toast.success(`Issued ${res.issued} - emailed ${res.emailed}`);
      router.refresh(); // re-render the server page so remaining + monitor update
    });

  const issuePool = () =>
    start(async () => {
      const res = await clientIssuePoolVoucherAction({ service, orgParam, seats });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setPoolResult(res);
      toast.success(`Shared link created - ${res.seats} seats`);
      router.refresh();
    });

  if (!hasAllocation) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        No seats allocated for this service yet. Please contact your VIFM consultant.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Distribute to your staff</h2>

        {/* Mode: individual single-use codes (one per person) vs one shared link
            with N seats (the same link, redeemable N times). */}
        <div className="mt-3 inline-flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode("individual")}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${mode === "individual" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Send className="h-3.5 w-3.5" /> Individual codes
          </button>
          <button
            type="button"
            onClick={() => setMode("pool")}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${mode === "pool" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Link2 className="h-3.5 w-3.5" /> One shared link
          </button>
        </div>

        {mode === "individual" ? (
          <>
            <p className="mt-3 text-xs text-muted-foreground">
              One recipient per line - <code>email</code> or <code>email, name</code>. Each gets a single-use code emailed
              with their link. <span className="font-medium text-foreground">{remaining} seats remaining.</span>
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              dir="ltr"
              placeholder={"jane@org.com, Jane Doe\nomar@org.com"}
              className="mt-3 w-full rounded-md border border-border bg-background p-3 font-mono text-xs focus:border-[#5391D5] focus:outline-none"
            />
            <Button onClick={issue} disabled={pending || !text.trim()} className="mt-2 gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Issue &amp; email
            </Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-xs text-muted-foreground">
              Creates ONE code with the seats you choose - share the same redeem link with your whole group. Each person
              who opens it uses one seat. <span className="font-medium text-foreground">{remaining} seats remaining.</span>
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Seats in the shared link</span>
                <input
                  type="number"
                  min={1}
                  max={remaining || undefined}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
                  className="w-36 rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-[#5391D5] focus:outline-none"
                />
              </label>
              <Button onClick={issuePool} disabled={pending || seats < 1 || seats > remaining} className="gap-2">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Generate shared link
              </Button>
            </div>
            {seats > remaining && <p className="mt-1 text-xs text-amber-600">Only {remaining} seats remaining.</p>}
          </>
        )}
      </div>

      {/* Individual mode: per-recipient result table. */}
      {result && mode === "individual" && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 text-sm font-medium text-foreground">
            Issued {result.issued} · emailed {result.emailed}
            {result.emailed < result.issued ? " (for the rest, copy the link below and send it yourself)" : ""}.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-3">Recipient</th>
                  <th className="py-1.5 pr-3">Emailed</th>
                  <th className="py-1.5 pr-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {result.codes.map((c) => (
                  <tr key={c.email} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{c.email}</td>
                    <td className="py-1.5 pr-3">{c.emailed ? "Yes" : "No"}</td>
                    <td className="py-1.5 pr-3">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(c.url);
                          toast.success("Link copied");
                        }}
                        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-muted"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pool mode: one shared link + copy. */}
      {poolResult && mode === "pool" && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-[#5391D5]" /> Shared link created - {poolResult.seats} seats
          </div>
          <p className="text-xs text-muted-foreground">
            Share this one link with your group. The first {poolResult.seats} people to open it can take the assessment.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={poolResult.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(poolResult.url);
                toast.success("Link copied");
              }}
              className="inline-flex items-center gap-1 rounded border px-3 py-2 text-xs hover:bg-muted"
            >
              <Copy className="h-3 w-3" /> Copy link
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Code: <span className="font-mono">{poolResult.code}</span>
          </p>
        </div>
      )}
    </div>
  );
}
