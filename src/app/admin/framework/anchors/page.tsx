import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { AnchorsConsole, type AnchorCompetency } from "./_components/anchors-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rating anchors · VIFM" };

// B19 (BPS 4.31) - the scale-point anchors of the ACTIVE framework: what a
// 1..5 looks like for each competency. Admin review surface; the /admin layout
// already gates the route to admins and every action re-checks.

type Row = {
  id: string;
  name: string;
  sort_order: number;
  competency_clusters: { name: string; sort_order: number; competency_domains: { name: string; sort_order: number } | null } | null;
};

export default async function AnchorsPage() {
  const sb = createServiceClient();
  const { data: comps } = await sb
    .from("competencies")
    .select("id, name, sort_order, competency_clusters(name, sort_order, competency_domains(name, sort_order))")
    .is("retired_at", null);
  const ids = ((comps ?? []) as unknown as Row[]).map((c) => c.id);
  const { data: anchors } = await sb
    .from("competency_scale_anchors")
    .select("id, competency_id, scale_point, anchor_en, anchor_ar, source, sme_status, sme_reviewer_name, sme_reviewed_at")
    .in("competency_id", ids.length > 0 ? ids : ["none"]);

  const list: AnchorCompetency[] = ((comps ?? []) as unknown as Row[])
    .map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.competency_clusters?.competency_domains?.name ?? "",
      cluster: c.competency_clusters?.name ?? "",
      order: [c.competency_clusters?.competency_domains?.sort_order ?? 9, c.competency_clusters?.sort_order ?? 99, c.sort_order] as [number, number, number],
      anchors: (anchors ?? [])
        .filter((a) => a.competency_id === c.id)
        .sort((a, b) => a.scale_point - b.scale_point)
        .map((a) => ({
          id: a.id as string,
          scale_point: a.scale_point as number,
          anchor_en: a.anchor_en as string,
          anchor_ar: (a.anchor_ar as string | null) ?? "",
          source: a.source as string,
          sme_status: a.sme_status as string,
          sme_reviewer_name: (a.sme_reviewer_name as string | null) ?? null,
        })),
    }))
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]);

  return (
    <div className="space-y-6">
      <BackLink href="/admin/framework" label="Back to the framework" />
      <div>
        <h1 className="text-2xl font-bold text-[#010131]">Rating anchors</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What each point of the 1-5 scale looks like for each competency, so every assessor reads a score the same way
          (BPS clause 4.31). Assessors see these on the rating screen and in the wash-up. AI drafts stay marked as drafts
          until approved here or through the SME review workbook. Editing an anchor returns it to pending.
        </p>
      </div>
      <AnchorsConsole competencies={list} />
    </div>
  );
}
