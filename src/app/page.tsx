import { PlatformLanding } from "./_components/platform-landing";
import { PortalSidebar } from "@/components/shared/portal-sidebar";
import { MobileSidebar } from "@/components/shared/mobile-sidebar";
import { loadBespokeServices } from "@/lib/bespoke/services";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VIFM Academy · Learning, assessment & readiness",
  description:
    "The VIFM Academy turns assessment insight into self-paced finance & management programmes for the GCC - with AI knowledge-checks, verifiable credentials, and seven bilingual diagnostic services that personalise each learning path.",
};

export default async function Home() {
  // Academy-led front screen: the left panel for navigation, with the Academy
  // landing as the scrolling content beside it.
  const bespokeProducts = (await loadBespokeServices())
    .filter((s) => s.kind === "role_readiness")
    .map((s) => ({ id: s.id, nameEn: s.name_en, nameAr: s.name_ar, roleConfigId: s.role_config_id }));
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
