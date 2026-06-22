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
