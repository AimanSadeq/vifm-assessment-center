import type { Metadata } from "next";
import { PortalComparison } from "./_components/portal-comparison";

export const metadata: Metadata = {
  title: "Portal comparison - Talent Acquisition vs Talent Development | VIFM",
  description:
    "Every VIFM portal side by side: what each measures, how it runs, and the reporting it produces, in its Talent Acquisition (selection) and Talent Management (development) use.",
};

export default function ComparePage() {
  return <PortalComparison />;
}
