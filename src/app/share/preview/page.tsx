import { notFound } from "next/navigation";
import { parseBrandParams } from "@/lib/licensed-preview/parse";
import { Tenant } from "@/app/licensed-preview/_components/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caliber · Licensed Portal Preview" };

// Public, read-only shareable variant of the Licensed Portal Preview - a
// leave-behind a prospect can open with no account. Auth is bypassed in
// middleware (isPublicPreviewRoute). All sample data, no real records. shareMode
// hides the admin "Exit" and any internal chrome.
export default async function SharePreviewPage({
  searchParams,
}: {
  searchParams?: { org?: string; sector?: string; region?: string; accent?: string; logo?: string; featured?: string };
}) {
  const brand = parseBrandParams(searchParams);
  if (!brand) notFound();

  return <Tenant brand={brand} shareMode />;
}
