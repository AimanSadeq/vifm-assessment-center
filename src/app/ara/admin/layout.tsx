import { notFound } from "next/navigation";
import { getCurrentCaller } from "@/lib/ara/auth-guards";

// Admin-only gate for the ARA admin consoles (question bank, regulatory,
// retention, sandbox, vouchers). Service-role pages, so the gate lives here.
export default async function AraAdminLayout({ children }: { children: React.ReactNode }) {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") notFound();
  return <>{children}</>;
}
