"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { acknowledgePackAction } from "../actions";

export function PackAcknowledgement({ candidateId, asAdmin }: { candidateId: string; asAdmin: boolean }) {
  const router = useRouter();
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const res = await acknowledgePackAction(candidateId);
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That could not be saved.");
      return;
    }
    toast.success("Thank you. You can now go through the consent form.");
    router.push(`/candidate/consent/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`);
  };

  return (
    <>
      <div className="flex items-start gap-3">
        <Checkbox id="pack-read" checked={read} onCheckedChange={(c) => setRead(c === true)} />
        <Label htmlFor="pack-read" className="text-sm leading-relaxed">
          I have read this information and I know what to expect, who will see my results and how long they are kept.
        </Label>
      </div>
      <Button onClick={confirm} disabled={!read || busy}>
        {busy ? "Saving..." : "Confirm and continue to consent"}
      </Button>
    </>
  );
}
