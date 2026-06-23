import { notFound } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { BackLink } from "@/components/shared/back-link";
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
      <div>
        <h1 className="text-2xl font-bold">Bespoke Services</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Combine any of VIFM&apos;s services into a single tailored package and assign it to a
          client - design exactly the engagement they need.
        </p>
      </div>
      <BespokeBuilder clients={clients} />
    </div>
  );
}
