"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import {
  createClientOrganization, updateClientOrganization,
  type CreateClientInput, type CreateClientResult, type UpdateClientInput, type UpdateClientResult,
} from "@/lib/clients/registry";

/** Create a client from the Platform Clients page - written to every service's
 *  org store. Admin-gated (synthetic admin under AUTH_ENABLED=false). */
export async function createClientAction(input: CreateClientInput): Promise<CreateClientResult> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized." };
    throw e;
  }
  const res = await createClientOrganization(input);
  if (res.ok) {
    revalidatePath("/admin/clients");
    revalidatePath("/ara/admin/organizations");
  }
  return res;
}

/** Amend a client's name (and industry/country) across both org stores. */
export async function updateClientAction(input: UpdateClientInput): Promise<UpdateClientResult> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized." };
    throw e;
  }
  const res = await updateClientOrganization(input);
  if (res.ok) {
    revalidatePath("/admin/clients");
    revalidatePath("/ara/admin/organizations");
  }
  return res;
}
