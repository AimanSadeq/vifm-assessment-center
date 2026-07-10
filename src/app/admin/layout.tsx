import { notFound } from "next/navigation";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { AdminChrome } from "./_components/admin-chrome";

// Server-side role gate for the ENTIRE /admin surface. Middleware enforces
// authentication only (not role), and individual admin pages vary between the
// RLS-backed authenticated client and the RLS-bypassing service-role client -
// so without this gate any logged-in user could reach a service-role admin
// page and read its data. Gating here closes the whole surface in one place.
// Under AUTH_ENABLED=false getCurrentCaller returns a synthetic admin, so dev
// still works; under auth=on a non-admin gets a clean 404.
//
// One deliberate exception: a portal client_manager. The middleware confines a
// client_manager to their own /portal for EVERY /admin PAGE route except the
// allow-listed /admin/tech-sandbox/results (the Techno on-screen development
// report their intelligence sheet deep-links to). The middleware matcher covers
// /admin/*, and isTechSandboxRoute matches only /tech-sandbox + /api/tech-sandbox
// (never /admin/tech-sandbox), so the ONLY /admin page a client_manager can
// reach is that results page - which self-gates on an org-name match. Let them
// through WITHOUT AdminChrome so no admin navigation leaks into their view;
// this layout otherwise 404s a link the portal legitimately renders.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const caller = await getCurrentCaller();
  if (!caller) notFound();
  if (caller.role === "client_manager") return <>{children}</>;
  if (caller.role !== "admin") notFound();
  return <AdminChrome>{children}</AdminChrome>;
}
