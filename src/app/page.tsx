import { PlatformLanding } from "./_components/platform-landing";
import { PortalSidebar } from "@/components/shared/portal-sidebar";

export const metadata = {
  title: "VIFM · Assessment, readiness & development",
  description:
    "VIFM's bilingual talent platform for the GCC: AI-assisted pre-employment screening, AI English placement, competency assessment centers, 360 leadership feedback, and organisational AI readiness.",
};

export default function Home() {
  // The landing page carries the same left panel as the portals (shared
  // PortalSidebar) so it reads as the platform home, not a detached splash.
  return (
    <div className="flex h-screen overflow-hidden">
      <PortalSidebar />
      <div className="min-w-0 flex-1 overflow-hidden">
        <PlatformLanding />
      </div>
    </div>
  );
}
