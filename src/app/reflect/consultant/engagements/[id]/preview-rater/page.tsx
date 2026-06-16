import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { GamifiedRaterForm } from "@/app/reflect/respond/[token]/_components/gamified-rater-form";
import { BackLink } from "@/components/shared/back-link";
import type {
  RaterContext,
  EngagementRow,
  FrameworkRow,
  CompetencyRow,
  BehaviorRow,
} from "@/lib/reflect/rater-access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Consultant-facing PREVIEW of the gamified rater experience. Loads the
// engagement's real framework and renders the gamified flow in no-save mode
// (a synthetic rater; nothing is written). Lets a consultant eyeball the
// experience without creating raters or sending invites.
export default async function PreviewRaterPage({ params }: Params) {
  const { id } = await params;
  const sb = createServiceClient();

  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select(
      "id, name, status, is_sandbox, gamified_mode, default_language, scale_type, anonymity_min_n, ara_organizations(id, name, name_ar)"
    )
    .eq("id", id)
    .maybeSingle<EngagementRow>();
  if (!engagement) return notFound();

  const { data: framework } = await sb
    .from("reflect_frameworks")
    .select("id, engagement_id, name_en, name_ar")
    .eq("engagement_id", id)
    .maybeSingle<FrameworkRow>();
  if (!framework) return notFound();

  const { data: comps } = await sb
    .from("reflect_competencies")
    .select("id, framework_id, name_en, name_ar, description_en, description_ar, display_order")
    .eq("framework_id", framework.id)
    .order("display_order");

  const compIds = (comps ?? []).map((c) => c.id);
  const { data: behs } =
    compIds.length === 0
      ? { data: [] as BehaviorRow[] }
      : await sb
          .from("reflect_behaviors")
          .select("id, competency_id, level_tier, text_en, text_ar, display_order")
          .in("competency_id", compIds)
          .order("display_order");

  const competencies = ((comps ?? []) as CompetencyRow[]).map((c) => ({
    ...c,
    behaviors: ((behs ?? []) as BehaviorRow[]).filter((b) => b.competency_id === c.id),
  }));

  const lang: "en" | "ar" = engagement.default_language === "ar" ? "ar" : "en";

  const ctx: RaterContext = {
    rater: {
      id: "preview",
      participant_id: "preview",
      rater_role: "peer",
      full_name: "Preview",
      email: "preview@example.com",
      language_preference: lang,
      access_token: "preview",
      status: "pending",
      invited_at: null,
      first_opened_at: null,
      completed_at: null,
      open_start: null,
      open_stop: null,
      open_continue: null,
      open_strengths: null,
      open_development: null,
      open_example: null,
      open_advice: null,
      open_other: null,
      critical_competency_ids: [],
      tenure: null,
    },
    participant: {
      id: "preview",
      engagement_id: id,
      full_name: lang === "ar" ? "قائد نموذجي" : "Sample Leader",
      full_name_ar: "قائد نموذجي",
      email: "sample@example.com",
      role_title: null,
      business_unit: null,
      level_tier: "all",
      language_preference: lang,
    },
    engagement,
    framework,
    competencies,
    responses: new Map(),
    openResponses: { start: "", stop: "", continue_: "" },
    openQuestions: { strengths: "", development: "", example: "", advice: "", other: "" },
    criticalCompetencyIds: [],
    tenure: null,
  };

  return (
    <>
      <BackLink href="/reflect" label="Back" history />
      <GamifiedRaterForm ctx={ctx} preview />
    </>
  );
}
