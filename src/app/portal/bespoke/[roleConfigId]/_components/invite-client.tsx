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
          seats: input.seats,
          orgParam,
        })
      }
    />
  );
}
