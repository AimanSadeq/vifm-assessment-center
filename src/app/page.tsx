import { PlatformLanding } from "./_components/platform-landing";
import { PortalSidebar } from "@/components/shared/portal-sidebar";
import { MobileSidebar } from "@/components/shared/mobile-sidebar";
import { loadBespokeServices } from "@/lib/bespoke/services";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { CaliberLandingPage } from "@/components/landing/caliber-landing-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VIFM Talent Intelligence Platform · Assessment & learning for the GCC",
  description:
    "One platform across the full talent lifecycle - bilingual assessments, AI-readiness diagnostics, verifiable credentials, and learning mapped to the gaps your diagnostics reveal. Built for the GCC.",
};

export default async function Home() {
  // Public visitors see the marketing landing; signed-in staff get the launcher.
  const caller = await getCurrentCaller().catch(() => null);
  if (!caller) {
    return <CaliberLandingPage />;
  }

  // Academy-led front screen: the left panel for navigation, with the Academy
  // landing as the scrolling content beside it.
  const bespokeProducts = (await loadBespokeServices())
    .filter((s) => s.kind === "role_readiness" || s.kind === "bundle")
    .map((s) => ({
      id: s.id,
      nameEn: s.name_en,
      nameAr: s.name_ar,
      roleConfigId: s.role_config_id,
      // Role Readiness opens its config; a composed bundle opens the composer.
      ...(s.kind === "bundle" ? { href: "/admin/bespoke" } : {}),
    }));
  return (
    <div className="flex h-screen overflow-hidden">
      <PortalSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile hamburger + drawer (lg:hidden); desktop shows PortalSidebar */}
        <MobileSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <PlatformLanding bespokeProducts={bespokeProducts} />
        </main>
      </div>
    </div>
  );
}
