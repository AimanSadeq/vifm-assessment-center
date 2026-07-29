"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { inviteEngagementManagerAction } from "../actions";

/** "Invite manager" per candidate row - creates the HiPo engagement survey
 *  token, emails the manager (best-effort), and always offers copy-link. */
export function InviteManagerDialog({
  candidateId,
  candidateName,
  orgParam,
}: {
  candidateId: string;
  candidateName: string;
  orgParam?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      const res = await inviteEngagementManagerAction({
        candidateId,
        managerName: name,
        managerEmail: email,
        orgParam,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setLink(res.url);
      toast.success(res.emailed ? "Survey emailed to the manager." : "Survey created - email is not configured, share the link below.");
    });

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copied.");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(""); setEmail(""); setLink(null); } }}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs font-semibold text-[#5391D5] hover:underline" title="Invite the line manager to the engagement survey">
          <UserCheck className="h-3.5 w-3.5" /> Invite manager
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-[#5391D5]" /> Manager engagement survey</DialogTitle>
          <DialogDescription>
            Six statements, about three minutes, answered by {candidateName}&apos;s line manager. Feeds the
            &quot;Engagement - will they stay?&quot; reading on the High-Potential Profile. A management judgement for the
            development conversation - never a pass/fail signal.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-700">Survey link (single use):</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="text-xs" />
              <Button variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can close this dialog - the link stays valid until the manager submits.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="mgr-name">Manager name <span className="text-rose-500">*</span></Label>
              <Input id="mgr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara Al-Mansouri" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mgr-email">Manager email <span className="text-rose-500">*</span></Label>
              <Input id="mgr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@company.com" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={submit} disabled={pending || !name.trim() || !email.trim()}>
                {pending ? "Creating…" : "Create + send survey"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
