"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Send, Loader2, CheckCircle2 } from "lucide-react";
import { resendReflectInvitationsAction } from "@/lib/reflect/actions";

export type RaterInvite = {
  id: string;
  full_name: string;
  email: string;
  rater_role: string;
  status: string;
  access_token: string;
  invited_at: string | null;
  participant_name: string;
};

const ROLE_LABEL: Record<string, string> = {
  self: "Self",
  manager: "Manager",
  peer: "Peer",
  direct_report: "Direct report",
  skip_level: "Skip-level",
  other: "Other",
};

// Per-rater invitation links + a resend control. The rating link is a private
// per-rater token URL; emails can be delayed or spam-filed, so the consultant
// can always copy a rater's link and send it directly. Origin is read from the
// browser so the link is absolute regardless of NEXT_PUBLIC_APP_URL.
export function RaterInvitations({
  engagementId,
  raters,
}: {
  engagementId: string;
  raters: RaterInvite[];
}) {
  const [origin, setOrigin] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);

  const linkFor = (token: string) => `${origin}/reflect/respond/${token}`;

  const copy = (token: string) => {
    navigator.clipboard.writeText(linkFor(token));
    toast.success("Invitation link copied - send it to the rater directly.");
  };

  const resend = () =>
    start(async () => {
      const res = await resendReflectInvitationsAction(engagementId);
      if ("ok" in res && res.ok) {
        toast.success(
          `Re-sent ${res.count} invitation${res.count === 1 ? "" : "s"}${res.failed ? `, ${res.failed} failed` : ""}.`
        );
      } else {
        toast.error(("error" in res && res.error) || "Could not resend invitations.");
      }
    });

  const pendingCount = raters.filter((r) => !r.invited_at).length;
  const responded = (s: string) => s === "completed" || s === "responded" || s === "submitted";

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">Rater invitations</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Each rater answers via their own private link. If an invitation email did not arrive (check spam first),
            copy the link and send it to the rater directly.
          </p>
        </div>
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
          title="Re-email everyone who has not been invited yet"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Resend pending{pendingCount ? ` (${pendingCount})` : ""}
        </button>
      </div>
      {raters.length === 0 ? (
        <p className="text-sm text-muted-foreground">No raters yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                <th className="py-2 pr-3">Rater</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Rating on</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Link</th>
              </tr>
            </thead>
            <tbody>
              {raters.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-primary">{r.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{ROLE_LABEL[r.rater_role] ?? r.rater_role}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.participant_name}</td>
                  <td className="py-2 pr-3">
                    {responded(r.status) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Responded
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground border">
                        {r.invited_at ? "Invited" : "Not invited"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <button
                      type="button"
                      onClick={() => copy(r.access_token)}
                      disabled={!origin}
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] text-accent hover:bg-muted disabled:opacity-50"
                      title="Copy this rater's private rating link"
                    >
                      <Copy className="h-3 w-3" /> Copy link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
