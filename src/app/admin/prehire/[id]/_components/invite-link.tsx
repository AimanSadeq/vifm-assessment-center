"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link2, Check, Mail, Loader2 } from "lucide-react";
import { resendPrehireInviteAction } from "../../actions";

export function InviteLink({ token, candidateId }: { token: string; candidateId: string }) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [url, setUrl] = useState("");

  // Build the absolute URL client-side (avoids SSR/hydration mismatch).
  useEffect(() => {
    setUrl(`${window.location.origin}/prehire/apply/${token}`);
  }, [token]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const resend = async () => {
    setSending(true);
    const res = await resendPrehireInviteAction(candidateId);
    setSending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.emailed
        ? "Invitation re-sent by email."
        : "Email isn't configured — use the invite link instead."
    );
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={copy} title={url} className="gap-1.5">
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Invite link"}
      </Button>
      <Button variant="ghost" size="sm" onClick={resend} disabled={sending} className="gap-1.5" title="Email this invite again">
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        {sending ? "Sending…" : "Email"}
      </Button>
    </div>
  );
}
