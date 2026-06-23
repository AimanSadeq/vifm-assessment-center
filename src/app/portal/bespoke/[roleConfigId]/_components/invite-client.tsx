"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientInviteRoleCandidateAction } from "../actions";

export function InviteClient({ roleConfigId, orgParam }: { roleConfigId: string; orgParam?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");

  const invite = () =>
    start(async () => {
      const res = await clientInviteRoleCandidateAction({ roleConfigId, fullName: name, email, orgParam });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setLink(`${window.location.origin}/role-readiness/apply/${res.token}`);
      setName("");
      setEmail("");
      toast.success("Invite created - copy the link to send");
      router.refresh();
    });

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <Send className="h-4 w-4 text-[#5391D5]" /> Invite a candidate
      </h2>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="min-w-40 flex-1" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@org.com" className="min-w-48 flex-1" />
        <Button onClick={invite} disabled={pending || name.trim().length < 2 || !email.trim()} className="gap-1.5">
          <Send className="h-4 w-4" /> Create invite link
        </Button>
      </div>
      {link && (
        <div className="mt-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 rounded-md border bg-muted px-2 py-1.5 font-mono text-xs" />
          <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs hover:bg-muted">
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      )}
    </div>
  );
}
