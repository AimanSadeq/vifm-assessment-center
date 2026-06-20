import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { ShieldCheck, UserRound } from "lucide-react";

/**
 * Global signed-in indicator - a fixed top-right pill showing the current
 * viewer's role (Admin vs everyone else) on EVERY page. Server component,
 * mounted once in the root layout.
 *
 * Renders nothing when there is no session - so a candidate on a token-gated
 * page (respondent form, /prehire/apply, magic-link results) never sees it,
 * and the login page stays clean. getCurrentCaller is wrapped so a session
 * read can never throw the whole page.
 */
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  consultant: "Consultant",
  candidate: "Candidate",
  client: "Client",
  lead_assessor: "Assessor",
  associate_assessor: "Assessor",
};

export async function SessionIndicator() {
  let caller: Awaited<ReturnType<typeof getCurrentCaller>> = null;
  try {
    caller = await getCurrentCaller();
  } catch {
    return null;
  }
  if (!caller) return null;

  const isAdmin = caller.role === "admin";
  const label = ROLE_LABEL[caller.role] ?? caller.role;
  const Icon = isAdmin ? ShieldCheck : UserRound;

  return (
    <div
      title={`Signed in as ${label}`}
      className="fixed top-2 right-2 z-[70] flex items-center gap-1.5 rounded-full border border-border bg-white/90 px-2.5 py-1 text-[11px] shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75"
    >
      <Icon className={`h-3.5 w-3.5 ${isAdmin ? "text-[#5391D5]" : "text-emerald-600"}`} />
      <span className="hidden text-muted-foreground sm:inline">Signed in as</span>
      <span className="font-bold text-[#010131]">{label}</span>
      {caller.isDev && <span className="text-amber-600">· dev</span>}
    </div>
  );
}
