"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientIssueVouchersAction, type ClientIssueResult } from "../actions";

type Issued = Extract<ClientIssueResult, { ok: true }>;

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
  const [text, setText] = useState("");
  const [result, setResult] = useState<Issued | null>(null);

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
        <p className="mt-1 text-xs text-muted-foreground">
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
      </div>

      {result && (
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
    </div>
  );
}
