import { notFound } from "next/navigation";
import { getCurrentCaller } from "@/lib/ara/auth-guards";

// Role gate for the whole ARA consultant area. Middleware enforces auth only;
// these pages use the service-role client, so without this any logged-in user
// could read the consultant pipeline. Consultant or admin only; id-bearing
// pages additionally enforce ownership. Dev (AUTH_ENABLED=false) -> synthetic
// admin, so dev still works.
export default async function AraConsultantLayout({ children }: { children: React.ReactNode }) {
  const caller = await getCurrentCaller();
  if (!caller || (caller.role !== "consultant" && caller.role !== "admin")) notFound();
  return <>{children}</>;
}
