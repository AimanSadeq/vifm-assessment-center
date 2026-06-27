"use client";

import { RrVoucherPanel } from "@/components/shared/rr-voucher-panel";
import { clientIssueRoleVouchersAction } from "../actions";

// Client-portal voucher issuance for a Role Readiness programme: individual links
// or one shared multi-seat link. Org is resolved server-side in the action.
export function InviteClient({ roleConfigId, orgParam }: { roleConfigId: string; orgParam?: string }) {
  return (
    <RrVoucherPanel
      onIssue={(input) =>
        clientIssueRoleVouchersAction({
          roleConfigId,
          mode: input.mode,
          emails: input.emails,
          delegates: input.delegates,
          seats: input.seats,
          sendEmails: input.sendEmails,
          origin: input.origin,
          orgParam,
          clientName: input.clientName,
          projectLabel: input.projectLabel,
          expiresAt: input.expiresAt,
          contactName: input.contactName,
          contactTitle: input.contactTitle,
          contactEmail: input.contactEmail,
        })
      }
    />
  );
}
