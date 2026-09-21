"use client";

/**
 * Asked of every participant (BPS 5.46), not left for them to raise. A
 * participant who is never asked cannot reasonably be said to have declined.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setAdjustmentNeedAction } from "../actions";

export function AdjustmentRequest({
  candidateId,
  status,
  request,
  agreed,
  extraMinutes,
}: {
  candidateId: string;
  status: string;
  request: string;
  agreed: string;
  extraMinutes: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(request);
  const [busy, setBusy] = useState(false);

  const save = async (needs: boolean) => {
    setBusy(true);
    const res = await setAdjustmentNeedAction({ candidateId, needs, request: text });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That could not be saved.");
      return;
    }
    toast.success(needs ? "Thank you. The assessment team will be in touch." : "Thank you, that is noted.");
    setOpen(false);
    router.refresh();
  };

  const decided = status === "agreed" || status === "declined";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Do you need anything adjusted?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          If a disability, health condition or anything else would make it harder for you to show what you can do,
          tell us and we will arrange what is reasonable. Extra time, a different format, a break between exercises,
          a particular room: all of it is normal and none of it is recorded as part of your results.
        </p>

        {decided ? (
          <div className={`rounded border p-3 ${status === "agreed" ? "border-emerald-200 bg-emerald-50" : "bg-muted/40"}`}>
            <div className="font-medium">
              {status === "agreed" ? "What we have arranged" : "Our answer"}
            </div>
            <p className="mt-1 whitespace-pre-wrap">{agreed}</p>
            {extraMinutes ? (
              <p className="mt-1 text-xs text-muted-foreground">Extra time: {extraMinutes} minutes per timed exercise.</p>
            ) : null}
            {request ? (
              <p className="mt-2 text-xs text-muted-foreground">You asked: {request}</p>
            ) : null}
          </div>
        ) : status === "requested" ? (
          <div className="rounded border bg-muted/40 p-3">
            <p>We have your request and will come back to you.</p>
            <p className="mt-1 text-xs text-muted-foreground">You asked: {request}</p>
          </div>
        ) : status === "none_needed" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground">You told us you do not need any adjustments.</p>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              I have changed my mind
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)} disabled={busy}>
              Yes, I need an adjustment
            </Button>
            <Button size="sm" variant="outline" onClick={() => save(false)} disabled={busy}>
              No, nothing needed
            </Button>
          </div>
        )}

        {open && !decided && (
          <div className="space-y-2">
            <Textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What would help? You do not have to give a diagnosis or any medical detail."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save(true)} disabled={busy || text.trim().length < 5}>
                Send
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
