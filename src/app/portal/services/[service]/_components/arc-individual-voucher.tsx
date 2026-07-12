"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Loader2, Copy, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientIssueArcVouchersAction } from "../seat-actions";

// ARC INDIVIDUAL track for the client portal: a person's own AI-readiness via a
// voucher - individual single-use codes (one per recipient) or one shared link
// with N seats. Mirrors the voucher services' UX. The cohort (Department /
// Division / Organization) flow stays on the seat invite panel below this.

type IssuedCode = { code: string; email?: string };
type Mode = "individual" | "pool";

export function ArcIndividualVoucher({
  orgParam,
  remaining,
}: {
  orgParam?: string;
  remaining: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>("individual");
  const [text, setText] = useState("");
  const [seats, setSeats] = useState(10);
  const [origin, setOrigin] = useState("");
  const [result, setResult] = useState<{ mode: Mode; codes: IssuedCode[]; seats: number } | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  // Only the opaque CODE travels in the URL. The redeem page (/ara/redeem) prefills
  // from the code server-side and never reads an email param, so appending the
  // delegate's email was dead weight that leaked PII via logs / browser history /
  // the Referer header - matching the strip already applied in voucher-issue.ts and
  // role-readiness redeemUrlFor(). The email is still shown in the on-screen roster.
  const redeemUrl = (c: IssuedCode) => `${origin}/ara/redeem?code=${encodeURIComponent(c.code)}`;

  const issue = () =>
    start(async () => {
      const res = await clientIssueArcVouchersAction(
        mode === "individual"
          ? { orgParam, mode, delegatesText: text }
          : { orgParam, mode, seats }
      );
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResult({ mode: res.mode, codes: res.codes, seats: res.seats });
      if (mode === "individual") setText("");
      toast.success(
        res.mode === "individual"
          ? `Created ${res.codes.length} code${res.codes.length === 1 ? "" : "s"}`
          : `Shared link created - ${res.seats} seats`
      );
      router.refresh();
    });

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied");
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <UserPlus className="h-4 w-4 text-[#5391D5]" /> Individual readiness (vouchers)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        For one person&apos;s own AI-readiness result. Issue individual codes or one shared link - each redeem uses one
        seat. <span className="font-medium text-foreground">{remaining} seats remaining.</span>
      </p>

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
            One recipient per line - <code>email</code> or <code>email, name</code>. Each gets a single-use code + a
            redeem link to send.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            dir="ltr"
            placeholder={"jane@org.com, Jane Doe\nomar@org.com"}
            className="mt-2 w-full rounded-md border border-border bg-background p-3 font-mono text-xs focus:border-[#5391D5] focus:outline-none"
          />
          <Button onClick={issue} disabled={pending || !text.trim()} className="mt-2 gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Generate codes
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Creates ONE code with the seats you choose - share the same redeem link with your group.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
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
            <Button onClick={issue} disabled={pending || seats < 1 || seats > remaining} className="gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Generate shared link
            </Button>
          </div>
          {seats > remaining && <p className="mt-1 text-xs text-amber-600">Only {remaining} seats remaining.</p>}
        </>
      )}

      {result && result.mode === "individual" && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Recipient</th>
                <th className="py-1.5 pr-3">Code</th>
                <th className="py-1.5 pr-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {result.codes.map((c) => (
                <tr key={c.code} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">{c.email ?? "-"}</td>
                  <td className="py-1.5 pr-3 font-mono">{c.code}</td>
                  <td className="py-1.5 pr-3">
                    <button
                      type="button"
                      onClick={() => copy(redeemUrl(c))}
                      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-muted"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Send each person their link. They enter their name / email / company when they start - the result is their own.
          </p>
        </div>
      )}

      {result && result.mode === "pool" && result.codes[0] && (
        <div className="mt-4">
          <div className="text-sm font-medium text-foreground">Shared link created - {result.seats} seats</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={redeemUrl(result.codes[0])}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
            />
            <button
              type="button"
              onClick={() => copy(redeemUrl(result.codes[0]))}
              className="inline-flex items-center gap-1 rounded border px-3 py-2 text-xs hover:bg-muted"
            >
              <Copy className="h-3 w-3" /> Copy link
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Share this one link with your group. The first {result.seats} people to open it can take the assessment.
          </p>
        </div>
      )}
    </div>
  );
}
