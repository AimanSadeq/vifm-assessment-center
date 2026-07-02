"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientInviteBundleCandidateAction } from "../actions";

/** Client-portal candidate invite for a bundle's one-sitting flow. Each invite
 *  draws one seat from every bundled service's allocation (stated inline). */
export function BundleInviteClient({
  bundleId,
  orgParam,
  seatNote,
  canInvite,
}: {
  bundleId: string;
  orgParam?: string;
  /** e.g. "Each invite uses 1 Persona seat + 1 Logica seat." */
  seatNote: string;
  /** False when any bundled service has no seats remaining. */
  canInvite: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    setBusy(true);
    try {
      const res = await clientInviteBundleCandidateAction({ bundleId, fullName: name, email, orgParam });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const full = `${window.location.origin}${res.url}`;
      setUrl(full);
      try {
        await navigator.clipboard.writeText(full);
        toast.success("Invite link created and copied - share it with the candidate.");
      } catch {
        toast.success("Invite link created - copy it below.");
      }
      setName("");
      setEmail("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        <UserPlus className="h-4 w-4 text-[#5391D5]" /> Invite a candidate (one sitting)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The candidate gets a single link covering every section of this programme in order. {seatNote}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Candidate name" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidate@email.com" type="email" />
        <Button onClick={invite} disabled={busy || !canInvite || !name.trim() || !email.trim()} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {busy ? "Creating…" : "Create invite link"}
        </Button>
      </div>
      {!canInvite && (
        <p className="mt-2 text-xs text-amber-700">
          A bundled service has no seats remaining - ask your VIFM consultant to top up the allocation.
        </p>
      )}
      {url && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#010131]">{url}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Copied");
              } catch {
                toast.error("Could not copy - select the text manually.");
              }
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold text-[#5391D5] hover:bg-[#5391D5]/5"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      )}
    </div>
  );
}
