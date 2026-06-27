"use client";

import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleCard } from "@/components/shared/collapsible-card";
import { emailVoucherBatchToClientAction } from "@/lib/vouchers/email-actions";

// Collapsible "email the whole batch to a client" card, shared by every voucher
// page. Operates on the codes the page just generated (items = code + redeem
// link). Collapsed by default so it stays out of the way until needed.
export function VoucherClientEmailCard({
  serviceLabel,
  items,
}: {
  serviceLabel: string;
  items: { code: string; link: string }[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = items.length > 0 && email.trim().length > 3;

  async function send() {
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await emailVoucherBatchToClientAction({
      clientName: name,
      clientEmail: email,
      serviceLabel,
      items,
    });
    setBusy(false);
    if ("error" in res) setMsg({ ok: false, text: res.error });
    else {
      setMsg({ ok: true, text: `Sent ${items.length} link(s) to ${email.trim()}.` });
      setEmail("");
      setName("");
    }
  }

  return (
    <CollapsibleCard
      title="Email codes to a client"
      icon={Mail}
      defaultOpen={false}
      subtitle="Send all the codes you just generated to one client, in a single email, for them to distribute."
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Generate some codes above first - then send the whole batch here.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {items.length} code(s) ready. They will be sent as redeem links in one email.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Client name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ADNOC L&D" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Client email</Label>
              <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@client.com" />
            </div>
          </div>
          {msg && (
            <div className={`rounded-md p-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
              {msg.text}
            </div>
          )}
          <Button onClick={send} disabled={!ready || busy} className="w-full gap-1.5 sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send {items.length} link(s) to client
          </Button>
        </div>
      )}
    </CollapsibleCard>
  );
}
