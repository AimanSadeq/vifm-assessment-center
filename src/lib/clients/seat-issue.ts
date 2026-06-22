// Seat-service dispatch for the client portal (server-only). The three seat
// services (ARC, Reflect, Pre-Hire) each have a per-org "shell" the client
// populates; this routes invite + monitor calls to the right service module.
// Org + role are resolved by the CALLER; the module forces the shell's org and
// draws/releases seats atomically.

import type { CaliberService } from "./portal-services";
import type { Allocation } from "./allocations";
import { inviteArc, arcSeatActivity } from "./seat/arc";
import { inviteReflect, reflectSeatActivity } from "./seat/reflect";
import { invitePrehire, prehireSeatActivity } from "./seat/prehire";

export type { SeatActivity, SeatActivityRow } from "./seat/arc";
import type { SeatActivity } from "./seat/arc";

export type SeatDelegate = { email: string; name?: string };

const SEAT_SERVICES: CaliberService[] = ["arc", "reflect", "prehire"];
export function isSeatService(s: CaliberService): boolean {
  return SEAT_SERVICES.includes(s);
}

export type SeatInviteResult = { ok: true; invited: number; emailed: number } | { error: string };

export async function inviteSeatDelegates(opts: {
  service: CaliberService;
  orgId: string;
  araOrgId: string | null;
  alloc: Allocation;
  delegates: SeatDelegate[];
}): Promise<SeatInviteResult> {
  const { service, orgId, araOrgId, alloc, delegates } = opts;
  const args = { orgId, araOrgId, alloc, delegates };
  if (service === "arc") return inviteArc(args);
  if (service === "reflect") return inviteReflect(args);
  if (service === "prehire") return invitePrehire(args);
  return { error: "Not a VIFM-managed programme." };
}

export async function getSeatActivity(
  service: CaliberService,
  orgId: string,
  araOrgId: string | null,
): Promise<SeatActivity | null> {
  if (service === "arc") return arcSeatActivity(orgId, araOrgId);
  if (service === "reflect") return reflectSeatActivity(orgId, araOrgId);
  if (service === "prehire") return prehireSeatActivity(orgId, araOrgId);
  return null;
}
