import { notFound } from "next/navigation";
import { getCurrentCaller } from "@/lib/ara/auth-guards";

// Admin-only gate for the Reflect 360 admin console (library templates,
// retention/sandbox purge). Service-role pages, so the gate lives here.
export default async function ReflectAdminLayout({ children }: { children: React.ReactNode }) {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") notFound();
  return <>{children}</>;
}
