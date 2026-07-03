import { Camera, ShieldCheck } from "lucide-react";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getOrgSettings } from "@/lib/clients/org-settings";
import { BackLink } from "@/components/shared/back-link";
import { ProctoringToggle } from "./_components/proctoring-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Client portal" };

/**
 * Client-portal organisation settings (integrity pass). Lets the client decide
 * their own monitoring posture - the reviewer requirement that organisations can
 * "configure or disable security and monitoring features" to match their legal,
 * ethical, and organisational context.
 */
export default async function PortalSettingsPage({
  searchParams,
}: {
  searchParams?: { org?: string };
}) {
  const access = await resolvePortalAccess(searchParams?.org);
  const orgId = access.ok ? access.orgId : null;
  if (!orgId) {
    return (
      <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        No organisation context. Please contact your VIFM consultant.
      </p>
    );
  }
  const settings = await getOrgSettings(orgId);
  const orgSuffix = searchParams?.org ? `?org=${searchParams.org}` : "";

  return (
    <div className="space-y-6">
      <BackLink href={`/portal${orgSuffix}`} label="Back to portal" />
      <div>
        <h1 className="text-2xl font-semibold text-primary">Organisation settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assessment-integrity options for your organisation&apos;s sittings.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-[#5391D5]" />
          <h2 className="text-base font-semibold text-[#010131]">Camera proctoring - Fluent</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          When required, every Fluent (English placement) sitting issued through your vouchers
          runs with camera proctoring: the candidate consents on screen, periodic webcam
          snapshots are taken during the test, and your VIFM team can review them alongside the
          result. Snapshots are stored privately and deleted automatically after 90 days.
          Proctoring evidence is advisory - it prompts a human review and never automatically
          fails a candidate.
        </p>
        <div className="mt-4">
          <ProctoringToggle
            orgParam={searchParams?.org ?? null}
            initialEnabled={settings.fluent_proctoring_required === true}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#5391D5]" />
          <h2 className="text-base font-semibold text-[#010131]">Always-on integrity controls</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Independent of the toggle above, every assessment runs with the platform&apos;s
          standard integrity layer: answer keys held server-side and never sent to the
          browser, single-use test sessions, time limits with auto-submit, per-sitting option
          randomisation, and an advisory Integrity Signal (tab-switching, paste activity,
          mid-test IP changes, and an AI-likeness estimate on writing). These signals inform a
          human decision - no result is ever auto-rejected.
        </p>
      </section>
    </div>
  );
}
