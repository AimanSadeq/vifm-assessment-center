"use client";

import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The standard step-1 detail fields shared by every voucher wizard:
// Client Name, Project Label, Expiry, Contact Name, Title, Contact Email.
// Client name + project label + expiry persist on the voucher; the contact
// (name/title/email) is captured so step 3 can email the batch to the client.
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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem] space-y-1.5">
          <Label className="text-xs">Client name</Label>
          <Input
            value={value.clientName}
            onChange={set("clientName")}
            list={clients.length > 0 ? "vdf-clients" : undefined}
            placeholder="Client / organisation"
            readOnly={clientReadOnly}
          />
          {clients.length > 0 && (
            <datalist id="vdf-clients">
              {clients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
          {clientHint && <p className="text-[11px] text-muted-foreground">{clientHint}</p>}
        </div>
        <div className="flex-1 min-w-[10rem] space-y-1.5">
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
          <Label className="text-xs">Contact name</Label>
          <Input value={value.contactName} onChange={set("contactName")} placeholder="e.g. Sara Ahmed" />
        </div>
        <div className="flex-1 min-w-[9rem] space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input value={value.contactTitle} onChange={set("contactTitle")} placeholder="e.g. L&D Director" />
        </div>
        <div className="flex-1 min-w-[12rem] space-y-1.5">
          <Label className="text-xs">Contact email</Label>
          <Input type="email" inputMode="email" value={value.contactEmail} onChange={set("contactEmail")} placeholder="contact@client.com" />
        </div>
      </div>
    </div>
  );
}
