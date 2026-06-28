import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { Tenant } from "./_components/tenant";
import type { Sector, Region } from "@/lib/licensed-preview/sample-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Licensed Portal Preview · Caliber" };

const SECTORS: Sector[] = ["government", "banking", "general"];
const REGIONS: Region[] = ["uae", "saudi"];

export default async function LicensedPreviewPage({
  searchParams,
}: {
  searchParams?: { org?: string; sector?: string; region?: string; accent?: string };
}) {
  // BD/admin-only surface (no real data, but keep it an internal sales tool).
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const org = (searchParams?.org ?? "").trim();
  if (!org) redirect("/admin/licensed-preview");

  const sector = (SECTORS.includes(searchParams?.sector as Sector) ? searchParams?.sector : "government") as Sector;
  const region = (REGIONS.includes(searchParams?.region as Region) ? searchParams?.region : "saudi") as Region;
  const rawAccent = searchParams?.accent ?? "";
  const accent = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent : "#5391D5";

  return <Tenant brand={{ org, sector, region, accent }} />;
}
