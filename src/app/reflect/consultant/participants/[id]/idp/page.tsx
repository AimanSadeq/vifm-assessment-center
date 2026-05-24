import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Aperture, FileText } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { IdpEditor } from "./_components/idp-editor";
import type { IdpAction, IdpPriority, ReflectIdpStatus } from "@/lib/reflect/idp-actions";

export const metadata = {
  title: "VIFM Reflect 360 · IDP",
};

type Params = { params: Promise<{ id: string }> };

async function fetchIdpContext(participantId: string) {
  const sb = createServiceClient();

  const { data: participant } = await sb
    .from("reflect_participants")
    .select(
      "id, full_name, full_name_ar, email, role_title, level_tier, engagement_id, reflect_engagements!inner(id, name, ara_organizations(name))"
    )
    .eq("id", participantId)
    .maybeSingle<{
      id: string;
      full_name: string;
      full_name_ar: string | null;
      email: string;
      role_title: string | null;
      level_tier: string;
      engagement_id: string;
      reflect_engagements: {
        id: string;
        name: string;
        ara_organizations: { name: string } | null;
      };
    }>();
  if (!participant) return null;

  // Existing IDP (if any) — UPSERT-keyed by participant_id
  const { data: idp } = await sb
    .from("reflect_idps")
    .select("top_priorities, action_plan, success_measures, target_review_date, status, signed_off_at, updated_at")
    .eq("participant_id", participantId)
    .maybeSingle<{
      top_priorities: IdpPriority[] | null;
      action_plan: IdpAction[] | null;
      success_measures: string | null;
      target_review_date: string | null;
      status: ReflectIdpStatus;
      signed_off_at: string | null;
      updated_at: string;
    }>();

  // Framework competencies for the dropdown — same engagement
  const { data: framework } = await sb
    .from("reflect_frameworks")
    .select("id, reflect_competencies(id, name_en, name_ar, display_order)")
    .eq("engagement_id", participant.engagement_id)
    .maybeSingle<{
      id: string;
      reflect_competencies: Array<{
        id: string;
        name_en: string;
        name_ar: string | null;
        display_order: number;
      }>;
    }>();
  const competencies = (framework?.reflect_competencies ?? []).sort(
    (a, b) => a.display_order - b.display_order
  );

  return { participant, idp, competencies };
}

export default async function ReflectIdpPage({ params }: Params) {
  const { id } = await params;
  const ctx = await fetchIdpContext(id);
  if (!ctx) return notFound();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Link
            href={`/reflect/consultant/engagements/${ctx.participant.engagement_id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> {ctx.participant.reflect_engagements.name}
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Aperture className="h-5 w-5 text-accent" />
                <h1 className="text-xl font-semibold text-primary">
                  IDP · {ctx.participant.full_name}
                </h1>
              </div>
              <div className="text-xs text-muted-foreground">
                {ctx.participant.role_title ?? "—"}
                {" · "}
                {ctx.participant.reflect_engagements.ara_organizations?.name ?? ""}
              </div>
            </div>
            <a
              href={`/reflect/consultant/participants/${ctx.participant.id}/report?lang=en`}
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
              title="Open the participant's 360 report"
            >
              <FileText className="h-3.5 w-3.5" />
              View 360 report
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <IdpEditor
          participantId={ctx.participant.id}
          competencies={ctx.competencies}
          initial={{
            top_priorities: ctx.idp?.top_priorities ?? [],
            action_plan: ctx.idp?.action_plan ?? [],
            success_measures: ctx.idp?.success_measures ?? "",
            target_review_date: ctx.idp?.target_review_date ?? "",
            status: ctx.idp?.status ?? "draft",
            signed_off_at: ctx.idp?.signed_off_at ?? null,
          }}
        />
      </main>
    </div>
  );
}
