"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { certifyPrehireCandidateAction } from "@/app/admin/prehire/actions";

export function CertifyForm({
  requisitionId,
  candidateId,
  alreadyCertified,
}: {
  requisitionId: string;
  candidateId: string;
  alreadyCertified: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    if (!name.trim()) {
      toast.error("Enter your name as the reviewing assessor.");
      return;
    }
    start(async () => {
      const res = await certifyPrehireCandidateAction({
        requisitionId,
        candidateId,
        reviewerName: name.trim(),
        notes: notes.trim() || undefined,
      });
      if (res.ok) {
        toast.success(alreadyCertified ? "Certification updated." : "Candidate certified.");
        setName("");
        setNotes("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Confirm you have reviewed the candidate&apos;s AI-scored responses above. Certifying stamps the
        report &quot;SME-reviewed by &lt;your name&gt;&quot; with today&apos;s date. The AI scores are a signal -
        your review is what certifies the result.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="reviewer" className="text-xs">Reviewing assessor (your name)</Label>
          <Input id="reviewer" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Hassan" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes" className="text-xs">Reviewer notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any context for the client - e.g. confirms the AI read, or a caveat to weigh."
        />
      </div>
      {alreadyCertified ? (
        // UA-7: confirm before overwriting an existing certification.
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={pending || !name.trim()}>
              {pending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</>
              ) : (
                <><BadgeCheck className="mr-2 h-4 w-4" /> Update certification</>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Overwrite the existing certification?</AlertDialogTitle>
              <AlertDialogDescription>
                This candidate is already certified. Continuing replaces the recorded reviewer name,
                notes, and date with the values above. The previous certification is not kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={submit}>Update certification</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button onClick={submit} disabled={pending || !name.trim()}>
          {pending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</>
          ) : (
            <><BadgeCheck className="mr-2 h-4 w-4" /> Certify result</>
          )}
        </Button>
      )}
    </div>
  );
}
