import { notFound } from "next/navigation";
import { getCurrentCaller, isInternalAraRender } from "@/lib/ara/auth-guards";

// Role gate for the whole ARA consultant area. Middleware enforces auth only;
// these pages use the service-role client, so without this any logged-in user
// could read the consultant pipeline. Consultant or admin only; id-bearing
// pages additionally enforce ownership. Dev (AUTH_ENABLED=false) -> synthetic
// admin, so dev still works.
//
// Internal render bypass: the org PDF route authorizes its caller itself
// (requireAssessmentOwner - which also admits a portal client_manager for
// their own org) and then renders the report page via Puppeteer with the
// server-only x-ara-internal header. Without the bypass that render 404'd
// for client_manager and the "PDF" delivered was a print of the 404 page.
export default async function AraConsultantLayout({ children }: { children: React.ReactNode }) {
  if (await isInternalAraRender()) return <>{children}</>;
  const caller = await getCurrentCaller();
  if (!caller || (caller.role !== "consultant" && caller.role !== "admin")) notFound();
  return <>{children}</>;
}
