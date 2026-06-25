import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, FileText } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { BespokeBuilder } from "./_components/bespoke-builder";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bespoke Services · VIFM",
  description: "Combine VIFM services into a tailored package and assign it to a client.",
};

export default async function BespokeServicesPage() {
  // Self-gate: this page reads the full client list via the service-role
  // registry, so an authenticated non-admin must not reach it (the IDOR rail).
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  const clients = (await loadPlatformClients()).map((c) => ({ key: c.key, name: c.name }));

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Back" history />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bespoke Services</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Combine any of VIFM&apos;s services into a single tailored package and assign it to a
            client - design exactly the engagement they need.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/admin/bespoke/reports">
            <Button className="gap-1.5">
              <FileText className="h-4 w-4" /> Reports
            </Button>
          </Link>
          <Link href="/admin/bespoke/roles">
            <Button variant="outline" className="gap-1.5">
              <Boxes className="h-4 w-4" /> Role Readiness roles
            </Button>
          </Link>
        </div>
      </div>

      {/* Role Readiness: a configurable Persona + Techno bundle that produces a
          ready/not-ready verdict. Configured roles publish into the section. */}
      <div className="rounded-xl border bg-gradient-to-br from-[#010131] to-[#121140] p-5 text-white">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5391D5]/20 text-[#5391D5]">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Role Readiness (Persona + Techno)</div>
              <p className="mt-0.5 max-w-xl text-xs text-white/70">
                Bundle behavioural + technical into one candidate sitting with a ready/not-ready verdict and an
                auto development plan. Configure a role once - it surfaces here and on the landing.
              </p>
            </div>
          </div>
          <Link href="/admin/bespoke/roles">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#5391D5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5391D5]/90">
              Configure roles
            </span>
          </Link>
        </div>
      </div>

      <BespokeBuilder clients={clients} />
    </div>
  );
}
