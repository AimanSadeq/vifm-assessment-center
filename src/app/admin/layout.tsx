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
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") notFound();
  return <AdminChrome>{children}</AdminChrome>;
}
