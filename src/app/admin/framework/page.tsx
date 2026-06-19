import { BARS_SCALE } from "@/lib/competencies/framework-definitions";
import { loadFrameworkTree } from "@/lib/competencies/framework-tree";
import { FrameworkGrid } from "./_components/framework-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Competency Framework · VIFM" };

// The VIFM behavioural competency framework rendered as a branded grid:
// four domains -> clusters -> competencies, each on a five-point BARS, with a
// second tab of positive/negative behavioural indicators, a PDF download,
// search, per-domain filtering and an EN/AR toggle. Read-only reference.
//
// Data is read LIVE from the competency catalogue via loadFrameworkTree() (shared
// with the PDF route so the screen and the download never drift). The whole
// /admin surface is already admin-role-gated in admin/layout.tsx.

export default async function FrameworkPage() {
  const { domains, counts } = await loadFrameworkTree();
  return <FrameworkGrid domains={domains} scale={BARS_SCALE} counts={counts} />;
}
