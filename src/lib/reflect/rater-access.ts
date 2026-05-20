import { createServiceClient } from "@/lib/supabase/server";
import type { ReflectRaterRole } from "./validations";

export type RaterRow = {
  id: string;
  participant_id: string;
  rater_role: ReflectRaterRole;
  full_name: string;
  email: string;
  language_preference: "en" | "ar";
  access_token: string;
  status: "pending" | "started" | "completed" | "declined";
  invited_at: string | null;
  first_opened_at: string | null;
  completed_at: string | null;
  /** Start/Stop/Continue open-ended answers (P0 parity pass, migration 00036). */
  open_start: string | null;
  open_stop: string | null;
  open_continue: string | null;
  /**
   * P1 critical-competency picks (migration 00037). Used only by Self and
   * Manager raters — they pick competencies they consider most critical
   * for this role. Empty array = not yet picked.
   */
  critical_competency_ids: string[];
  /** P2 tenure (migration 00038). NULL until the rater answers it. */
  tenure: ReflectRaterTenure | null;
};

export type ReflectRaterTenure =
  | "less_than_6mo"
  | "six_mo_to_2yr"
  | "two_to_5yr"
  | "over_5yr";

export type ParticipantRow = {
  id: string;
  engagement_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  role_title: string | null;
  business_unit: string | null;
  level_tier: string;
  language_preference: "en" | "ar";
};

export type EngagementRow = {
  id: string;
  name: string;
  status: string;
  is_sandbox: boolean;
  default_language: "en" | "ar";
  scale_type: string;
  anonymity_min_n: number;
  ara_organizations: {
    id: string;
    name: string;
    name_ar: string | null;
  } | null;
};

export type FrameworkRow = {
  id: string;
  engagement_id: string;
  name_en: string;
  name_ar: string | null;
};

export type CompetencyRow = {
  id: string;
  framework_id: string;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  display_order: number;
};

export type BehaviorRow = {
  id: string;
  competency_id: string;
  level_tier: string;
  text_en: string;
  text_ar: string | null;
  display_order: number;
};

export type RaterContext = {
  rater: RaterRow;
  participant: ParticipantRow;
  engagement: EngagementRow;
  framework: FrameworkRow;
  competencies: Array<CompetencyRow & { behaviors: BehaviorRow[] }>;
  /** Already-saved responses keyed by behavior_id */
  responses: Map<
    string,
    { score: number | null; is_na: boolean; comment_text: string | null }
  >;
  /** Start/Stop/Continue open answers — survives revisits. */
  openResponses: {
    start: string;
    stop: string;
    continue_: string;
  };
  /** P1: list of competency_ids the rater flagged as role-critical. */
  criticalCompetencyIds: string[];
  /** P2: rater tenure (how long they've worked with the participant). */
  tenure: ReflectRaterTenure | null;
};

/**
 * Load the full rater context for the respondent form. Returns null if the
 * token is invalid OR the engagement is not 'live' (rater can't submit when
 * the engagement is closed/archived).
 *
 * The rater never has a Supabase session — token alone establishes identity.
 */
export async function loadRaterByToken(token: string): Promise<RaterContext | null> {
  const sb = createServiceClient();

  const { data: rater } = await sb
    .from("reflect_raters")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<RaterRow>();
  if (!rater) return null;

  const { data: participant } = await sb
    .from("reflect_participants")
    .select("*")
    .eq("id", rater.participant_id)
    .maybeSingle<ParticipantRow>();
  if (!participant) return null;

  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select(
      "id, name, status, is_sandbox, default_language, scale_type, anonymity_min_n, ara_organizations(id, name, name_ar)"
    )
    .eq("id", participant.engagement_id)
    .maybeSingle<EngagementRow>();
  if (!engagement) return null;

  const { data: framework } = await sb
    .from("reflect_frameworks")
    .select("id, engagement_id, name_en, name_ar")
    .eq("engagement_id", engagement.id)
    .maybeSingle<FrameworkRow>();
  if (!framework) return null;

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

  const competencies =
    (comps ?? []).map((c) => ({
      ...(c as CompetencyRow),
      behaviors: ((behs ?? []) as BehaviorRow[]).filter(
        (b) => b.competency_id === c.id
      ),
    })) ?? [];

  const { data: responses } = await sb
    .from("reflect_responses")
    .select("behavior_id, score, is_na, comment_text")
    .eq("rater_id", rater.id);

  const respMap = new Map<
    string,
    { score: number | null; is_na: boolean; comment_text: string | null }
  >();
  for (const r of (responses ?? []) as Array<{
    behavior_id: string;
    score: number | null;
    is_na: boolean;
    comment_text: string | null;
  }>) {
    respMap.set(r.behavior_id, {
      score: r.score,
      is_na: r.is_na,
      comment_text: r.comment_text,
    });
  }

  return {
    rater,
    participant,
    engagement,
    framework,
    competencies,
    responses: respMap,
    // open_* may be undefined when migration 00036 hasn't run in the
    // target environment yet — coerce via ??/?? to empty strings.
    openResponses: {
      start: (rater.open_start ?? "") || "",
      stop: (rater.open_stop ?? "") || "",
      continue_: (rater.open_continue ?? "") || "",
    },
    // P1 critical-competency picks (00037). Defensively coerces missing
    // column to empty so the form simply hides the picker.
    criticalCompetencyIds: rater.critical_competency_ids ?? [],
    // P2 tenure (00038). NULL until the rater answers.
    tenure: rater.tenure ?? null,
  };
}

/**
 * Quick lookup just for "is this token valid?" decisions that don't need
 * the full form context.
 */
export async function findRaterByToken(token: string): Promise<RaterRow | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("reflect_raters")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<RaterRow>();
  return data;
}
