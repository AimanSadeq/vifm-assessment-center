import { MobileSidebar } from "@/components/shared/mobile-sidebar";

// The standalone /ac/* tools (Fluent, Technical, Psychometrics, AI interview)
// are otherwise bare. Mount the shared mobile hamburger + drawer so the left
// panel is reachable on a phone here too. It's lg:hidden, so the immersive
// desktop runner experience is unchanged.
export default function AcLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileSidebar />
      {children}
    </>
  );
}
