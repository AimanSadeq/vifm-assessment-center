// Resolves who is viewing the client self-service portal and which org's data to
// show. A client_manager always sees their OWN org (from their profile - never
// from input). An admin may preview any org via ?org=<id> (a support affordance,
// mirroring the "view as" pattern). Anyone else is denied.

import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";

export type PortalAccess =
  | { ok: false }
  | {
      ok: true;
      role: "client_manager" | "admin";
      orgId: string | null;
      viewingAsAdmin: boolean;
      /** The signed-in person, for attributing what they issue. Null under the dev bypass. */
      uid: string | null;
    };

export async function resolvePortalAccess(orgParam?: string | null): Promise<PortalAccess> {
  const caller = await getCurrentCaller();
  if (!caller) return { ok: false };
  const uid = caller.isDev ? null : caller.uid;
  if (caller.role === "client_manager") {
    return { ok: true, role: "client_manager", orgId: await getClientOrgId(), viewingAsAdmin: false, uid };
  }
  if (caller.role === "admin") {
    return { ok: true, role: "admin", orgId: orgParam?.trim() || null, viewingAsAdmin: true, uid };
  }
  return { ok: false };
}
