"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/ara/auth-guards";
import { seedDemoData } from "@/lib/demo/seed";
import { purgeDemoData } from "@/lib/demo/purge";

export async function seedDemoDataAction() {
  await requireRole(["admin"]);
  const res = await seedDemoData();
  revalidatePath("/admin/demo");
  return res;
}

export async function purgeDemoDataAction() {
  await requireRole(["admin"]);
  const res = await purgeDemoData();
  revalidatePath("/admin/demo");
  return res;
}

/**
 * Remove and load again, in one action.
 *
 * Every service seeder skips itself when its demo rows already exist, so
 * loading on top of loaded data changes nothing. That is the right behaviour
 * for topping up a newly added service, and the wrong behaviour for refreshing
 * a demo after the seeder itself changed - which looked like success and was
 * not. Rebuilding is the operation people actually want in that case, so it is
 * a button rather than two clicks and a piece of folklore.
 */
export async function rebuildDemoDataAction() {
  await requireRole(["admin"]);
  const purged = await purgeDemoData();
  const seeded = await seedDemoData();
  revalidatePath("/admin/demo");
  return { purged, seeded };
}
