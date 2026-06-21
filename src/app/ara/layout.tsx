import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "VIFM AI Readiness Compass®",
    template: "%s · VIFM AI Readiness Compass",
  },
  description:
    "VIFM AI Readiness Compass - bilingual diagnostic platform for AI readiness across the GCC. Eight organisational pillars, sixteen regulatory frameworks, four engagement stages from a complimentary Personal Snapshot to a board-grade Enterprise diagnostic. Calibrated for UAE and Saudi Arabia.",
};

export default function AraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
