"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Link2, Copy, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IssuedVoucher } from "@/lib/role-readiness/vouchers";

type Mode = "individual" | "pool";
type IssueResult = { ok: true; vouchers: IssuedVoucher[] } | { error: string };

// Role Readiness voucher issuance - same model as the other portals: individual
// single-use vouchers (one complete link per recipient) OR one shared link with
// N seats. The parent supplies `onIssue` (admin- or client-scoped server action).
export function RrVoucherPanel({ onIssue }: { onIssue: (input: { mode: Mode; emails?: string[]; seats?: number }) => Promise<IssueResult> }) {
  const [mode, setMode] = useState<Mode>("individual");
  const [text, setText] = useState("");
  const [seats, setSeats] = useState(10);
  const [origin, setOrigin] = useState("");
  const [result, setResult] = useState<{ mode: Mode; vouchers: IssuedVoucher[] } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);

  const redeemUrl = (v: IssuedVoucher) =>
    `${origin}/role-readiness/redeem?code=${encodeURIComponent(v.code)}${v.email ? `&email=${encodeURIComponent(v.email)}` : ""}`;

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  const issue = () =>
    start(async () => {
      const res = await onIssue(
        mode === "individual"
          ? { mode, emails: text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) }
          : { mode, seats },
      );
      if ("error" in res) { toast.error(res.error); return; }
      setResult({ mode, vouchers: res.vouchers });
      if (mode === "individual") setText("");
      toast.success(mode === "individual" ? `Created ${res.vouchers.length} voucher(s)` : `Shared link created - ${res.vouchers[0]?.maxUses} seats`);
    });

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Send className="h-4 w-4 text-[#5391D5]" /> Issue vouchers</h2>
      <p className="mt-1 text-xs text-muted-foreground">Send an individual link per person, or one shared link many people can use. Each redeem starts a fresh sitting.</p>

      <div className="mt-3 inline-flex rounded-md border border-border p-0.5">
        <button type="button" onClick={() => setMode("individual")}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${mode === "individual" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}>
          <Send className="h-3.5 w-3.5" /> Individual links
        </button>
        <button type="button" onClick={() => setMode("pool")}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${mode === "pool" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}>
          <Link2 className="h-3.5 w-3.5" /> One shared link
        </button>
      </div>

      {mode === "individual" ? (
        <>
          <p className="mt-3 text-xs text-muted-foreground">One email per line. Each gets a single-use voucher + a complete redeem link to send.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} dir="ltr"
            placeholder={"jane@org.com\nomar@org.com"}
            className="mt-2 w-full rounded-md border border-border bg-background p-3 font-mono text-xs focus:border-[#5391D5] focus:outline-none" />
          <Button onClick={issue} disabled={pending || !text.trim()} className="mt-2 gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Generate vouchers
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">One code with the seats you choose - share the same link with your group.</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Seats</span>
              <input type="number" min={1} value={seats} onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
                className="w-32 rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-[#5391D5] focus:outline-none" />
            </label>
            <Button onClick={issue} disabled={pending || seats < 1} className="gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Generate shared link
            </Button>
          </div>
        </>
      )}

      {result && result.mode === "individual" && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Recipient</th><th className="py-1.5 pr-3">Code</th><th className="py-1.5 pr-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {result.vouchers.map((v) => (
                <tr key={v.code} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">{v.email ?? "-"}</td>
                  <td className="py-1.5 pr-3 font-mono">{v.code}</td>
                  <td className="py-1.5 pr-3">
                    <button type="button" onClick={() => copy(redeemUrl(v))} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-muted">
                      <Copy className="h-3 w-3" /> Copy link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">Send each person their link. They enter their name + email, then take the assessment.</p>
        </div>
      )}

      {result && result.mode === "pool" && result.vouchers[0] && (
        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-[#5391D5]" /> Shared link - {result.vouchers[0].maxUses} seats
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={redeemUrl(result.vouchers[0])} onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground" />
            <button type="button" onClick={() => copy(redeemUrl(result.vouchers[0]))} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-xs hover:bg-muted">
              <Copy className="h-3 w-3" /> Copy link
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Share this one link with your group. The first {result.vouchers[0].maxUses} people to open it can take the assessment.</p>
        </div>
      )}
    </div>
  );
}
