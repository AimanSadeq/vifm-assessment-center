import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { PreviewLauncher } from "./_components/launcher";
import { PREVIEW_MODULES } from "@/lib/licensed-preview/modules";
import { Layers } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Licensed Portal Preview · Caliber" };

export default async function AdminLicensedPreviewPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const capabilities = PREVIEW_MODULES.filter((m) => m.id !== "command");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#010131] text-white">
          <Layers className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Licensed Portal Preview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Show a prospect exactly what a whole-portal Caliber licence feels like - their own branded tenant, a
            workforce-intelligence command center, and every capability they would light up. Brand it to them, launch,
            and walk the room through the diagnose → develop → certify loop.
          </p>
        </div>
      </div>

      <PreviewLauncher />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">What the prospect sees inside</div>
        <p className="mt-1 text-sm text-muted-foreground">
          A navigable tenant with a Command Center plus a branded dashboard for each licensed capability:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {capabilities.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ background: m.tone }} />
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
