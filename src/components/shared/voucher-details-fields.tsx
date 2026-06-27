"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { addVoucherClientAction } from "@/lib/vouchers/client-actions";

// The standard step-1 detail fields shared by every voucher wizard, following
// ARC's exact lead: a "Which client?" dropdown from the platform client registry
// with an inline "+ Add a new client", then Project Label + Expiry, then the
// Contact row (name / title / email). Client name + project label + expiry persist
// on the voucher; the contact is captured so step 3 can email the batch to the client.
export type VoucherDetails = {
  clientName: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  projectLabel: string;
  expiresAt: string;
};

export const EMPTY_VOUCHER_DETAILS: VoucherDetails = {
  clientName: "",
  contactName: "",
  contactTitle: "",
  contactEmail: "",
  projectLabel: "",
  expiresAt: "",
};

/** Combine contact name + title into one display string for the email greeting. */
export function contactDisplayName(d: VoucherDetails): string {
  return d.contactTitle.trim() ? `${d.contactName} (${d.contactTitle})`.trim() : d.contactName;
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function VoucherDetailsFields({
  value,
  onChange,
  clients = [],
  clientReadOnly = false,
  clientHint,
}: {
  value: VoucherDetails;
  onChange: (v: VoucherDetails) => void;
  clients?: string[];
  /** When the client is fixed (e.g. Pre-Hire's requisition org), show it read-only. */
  clientReadOnly?: boolean;
  clientHint?: string;
}) {
  const set = (k: keyof VoucherDetails) => (e: ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });

  // Inline add-client (mirrors ARC): keep a local, mutable client list seeded from
  // the registry so a freshly-added client appears + selects immediately.
  const [clientList, setClientList] = useState<string[]>(clients);
  useEffect(() => setClientList(clients), [clients]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState<"uae" | "saudi">("uae");
  const [newSector, setNewSector] = useState<"government" | "banking" | "general">("general");
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const saveClient = async () => {
    const name = newName.trim();
    if (!name) { setAddErr("Enter a client name."); return; }
    setSaving(true);
    setAddErr(null);
    const res = await addVoucherClientAction({ name, region: newRegion, sector: newSector });
    setSaving(false);
    if (!res.ok) { setAddErr(res.error); return; }
    setClientList((prev) => (prev.some((c) => c.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))));
    onChange({ ...value, clientName: name });
    setShowAdd(false);
    setNewName("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[14rem] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Which client?</Label>
            {!clientReadOnly && (
              <button
                type="button"
                onClick={() => { setShowAdd((s) => !s); setAddErr(null); }}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
              >
                {showAdd ? <><X className="h-3 w-3" /> Cancel</> : <><Plus className="h-3 w-3" /> Add a new client</>}
              </button>
            )}
          </div>
          {clientReadOnly ? (
            <Input value={value.clientName} onChange={set("clientName")} placeholder="Client / organisation" readOnly />
          ) : (
            <select className={selectClass} value={value.clientName} onChange={(e) => onChange({ ...value, clientName: e.target.value })}>
              <option value="">- select a client -</option>
              {clientList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {clientHint && <p className="text-[11px] text-muted-foreground">{clientHint}</p>}
          {showAdd && !clientReadOnly && (
            <div className="mt-2 space-y-2 rounded-md border border-border bg-card p-3">
              <Input placeholder="New client / organisation name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <select className={selectClass} value={newRegion} onChange={(e) => setNewRegion(e.target.value as "uae" | "saudi")}>
                  <option value="uae">UAE</option>
                  <option value="saudi">Saudi</option>
                </select>
                <select className={selectClass} value={newSector} onChange={(e) => setNewSector(e.target.value as "government" | "banking" | "general")}>
                  <option value="general">General</option>
                  <option value="banking">Banking</option>
                  <option value="government">Government</option>
                </select>
              </div>
              {addErr && <p className="text-xs text-destructive">{addErr}</p>}
              <Button type="button" size="sm" onClick={saveClient} disabled={saving} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save client"}
              </Button>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-[12rem] space-y-1.5">
          <Label className="text-xs">Project label</Label>
          <Input value={value.projectLabel} onChange={set("projectLabel")} placeholder="e.g. Q3 intake" />
        </div>
        <div className="w-44 space-y-1.5">
          <Label className="text-xs">Expiry date</Label>
          <Input type="date" value={value.expiresAt} onChange={set("expiresAt")} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem] space-y-1.5">
          <Label className="text-xs">Client contact name</Label>
          <Input value={value.contactName} onChange={set("contactName")} placeholder="e.g. Sara Ahmed" />
        </div>
        <div className="flex-1 min-w-[10rem] space-y-1.5">
          <Label className="text-xs">Contact title</Label>
          <Input value={value.contactTitle} onChange={set("contactTitle")} placeholder="e.g. L&D Director" />
        </div>
        <div className="flex-1 min-w-[12rem] space-y-1.5">
          <Label className="text-xs">Contact email (for sending vouchers)</Label>
          <Input type="email" inputMode="email" value={value.contactEmail} onChange={set("contactEmail")} placeholder="contact@client.com" />
        </div>
      </div>
    </div>
  );
}
