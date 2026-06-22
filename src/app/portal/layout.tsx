import { notFound } from "next/navigation";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { PortalChrome } from "./_components/portal-chrome";

// Server-side role gate for the whole client self-service portal: only a
// client_manager (their own org) or an admin (preview) may enter. Mirrors the
// /admin layout's gate-then-chrome split.
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const access = await resolvePortalAccess();
  if (!access.ok) notFound();
  return <PortalChrome adminPreview={access.viewingAsAdmin}>{children}</PortalChrome>;
}
