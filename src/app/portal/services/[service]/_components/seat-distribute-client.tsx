"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientInviteSeatAction } from "../seat-actions";

export function SeatDistributeClient({
  service,
  orgParam,
  hasAllocation,
  remaining,
  kindLabel,
}: {
  service: string;
  orgParam?: string;
  hasAllocation: boolean;
  remaining: number;
  kindLabel: string;
}) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ invited: number; emailed: number } | null>(null);

  const invite = () =>
    start(async () => {
      const res = await clientInviteSeatAction({ service, orgParam, delegatesText: text });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      setText("");
      toast.success(`Invited ${res.invited} - emailed ${res.emailed}`);
    });

  if (!hasAllocation) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        No seats allocated for this programme yet. Please contact your VIFM consultant.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Invite your {kindLabel}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          One per line - <code>email</code> or <code>email, name</code>. Each draws one seat and is emailed an
          invitation. <span className="font-medium text-foreground">{remaining} seats remaining.</span>
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          dir="ltr"
          placeholder={"jane@org.com, Jane Doe\nomar@org.com"}
          className="mt-3 w-full rounded-md border border-border bg-background p-3 font-mono text-xs focus:border-[#5391D5] focus:outline-none"
        />
        <Button onClick={invite} disabled={pending || !text.trim()} className="mt-2 gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invite
        </Button>
      </div>
      {result && (
        <div className="rounded-xl border bg-card p-5 text-sm font-medium text-foreground">
          Invited {result.invited} · emailed {result.emailed}.
        </div>
      )}
    </div>
  );
}
