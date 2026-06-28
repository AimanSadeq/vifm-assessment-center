import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { parseBrandParams } from "@/lib/licensed-preview/parse";
import { Tenant } from "./_components/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Licensed Portal Preview · Caliber" };

export default async function LicensedPreviewPage({
  searchParams,
}: {
  searchParams?: { org?: string; sector?: string; region?: string; accent?: string; logo?: string; featured?: string };
}) {
  // BD/admin-only surface (no real data, but keep it an internal sales tool).
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const brand = parseBrandParams(searchParams);
  if (!brand) redirect("/admin/licensed-preview");

  return <Tenant brand={brand} />;
}
