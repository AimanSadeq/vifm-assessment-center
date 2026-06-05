"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { toast } from "sonner";
import {
  Wand2, SlidersHorizontal, ArrowLeft, ArrowRight, Check, Sparkles, Loader2,
  UserCheck, Sprout, TrendingUp, BadgeCheck, BrainCircuit, Users,
  ClipboardCheck, Compass, Aperture, Languages, UserSearch,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GOALS, CONTEXT_OPTIONS, resolveProcess } from "@/lib/start/resolver";
import type { StartDepth, WizardAnswers, ProcessPlan } from "@/lib/start/types";
import { createRequisitionAction } from "@/app/admin/prehire/actions";
import { createReflectEngagement } from "@/lib/reflect/actions";
import { createEngagementAction } from "@/app/admin/engagements/new/actions";
import { startAraAssessmentAction } from "../actions";

type AraOrg = { id: string; name: string; region: string; sector: string };
type ReflectTemplate = { id: string; name_en: string };
type AcCompetency = { id: string; name: string; domain: string; domainSort: number };
type AcExercise = { id: string; name: string; exercise_type: string };
type AcRoleProfile = { id: string; name_en: string; competencyIds: string[] };

// Icons + tone + data only — all copy comes from the start.* i18n namespace.
type Tone = "blue" | "violet" | "teal" | "gold" | "rose" | "indigo";
const GOAL_ICON: Record<string, LucideIcon> = {
  UserCheck, Sprout, TrendingUp, BadgeCheck, BrainCircuit, Users,
};
// Each goal gets one of the six platform hues so the launcher tiles read as a
// spectrum, mirroring the root "/" launcher's per-service tones.
const GOAL_TONE: Record<string, Tone> = {
  hire: "rose", develop: "teal", succession: "gold",
  certify: "indigo", ai_readiness: "violet", feedback_360: "blue",
};
const MODULE_MENU: { key: string; href: string; icon: LucideIcon; tone: Tone }[] = [
  { key: "prehire", href: "/admin/prehire/new", icon: UserSearch, tone: "rose" },
  { key: "ac", href: "/admin/engagements/new", icon: ClipboardCheck, tone: "blue" },
  { key: "ara", href: "/ara/consultant/assessments/new", icon: Compass, tone: "violet" },
  { key: "reflect", href: "/reflect/consultant/engagements/new", icon: Aperture, tone: "teal" },
  { key: "fluent", href: "/ac/fluent", icon: Languages, tone: "gold" },
  { key: "technical", href: "/ac/tech-assessment", icon: BadgeCheck, tone: "indigo" },
];
const PREHIRE_STAGES: { kind: "quiz" | "fluent" | "cbi"; weight: number; cut: number }[] = [
  { kind: "quiz", weight: 0.4, cut: 60 },
  { kind: "fluent", weight: 0.3, cut: 50 },
  { kind: "cbi", weight: 0.3, cut: 60 },
];

type Mode = "fork" | "wizard" | "myself";
type Props = {
  organizations: { id: string; name: string }[];
  roleProfiles: { id: string; name_en: string }[];
  araOrgs: AraOrg[];
  araVersionId: string | null;
  reflectTemplates: ReflectTemplate[];
  acCompetencies: AcCompetency[];
  acExercises: AcExercise[];
  acRoleProfiles: AcRoleProfile[];
};

export function GuidedStart({
  organizations, roleProfiles, araOrgs, araVersionId, reflectTemplates,
  acCompetencies, acExercises, acRoleProfiles,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("fork");
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<WizardAnswers>({ goal: null, context: null, depth: null });

  const reset = () => {
    setAnswers({ goal: null, context: null, depth: null });
    setStep(1);
  };

  // ── The fork (the "trigger at the top") ──
  if (mode === "fork") {
    return (
      <div className="space-y-8">
        <StartHero />
        <div className="space-y-3">
          <SectionLabel>{t("start.fork.heading")}</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <ForkCard
              icon={Wand2}
              tone="blue"
              title={t("start.fork.guideTitle")}
              desc={t("start.fork.guideDesc")}
              cta={t("start.fork.guideCta")}
              badge={t("start.fork.recommended")}
              onClick={() => { setMode("wizard"); reset(); }}
            />
            <ForkCard
              icon={SlidersHorizontal}
              tone="indigo"
              title={t("start.fork.myselfTitle")}
              desc={t("start.fork.myselfDesc")}
              cta={t("start.fork.myselfCta")}
              onClick={() => setMode("myself")}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── "Set it up myself" — links to the existing (untouched) create flows ──
  if (mode === "myself") {
    return (
      <div className="space-y-8">
        <StartHero compact onBack={() => setMode("fork")} />
        <div className="space-y-3">
          <SectionLabel>{t("start.myself.heading")}</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_MENU.map((m) => {
              const Icon = m.icon;
              return (
                <Link key={m.href} href={m.href} className={`launcher-card tone-${m.tone} block h-full p-4`}>
                  <Icon className="launcher-card-glyph h-16 w-16" strokeWidth={1} aria-hidden />
                  <div className="relative z-10 flex h-full flex-col">
                    <div className="launcher-card-icon mb-2 flex h-10 w-10 items-center justify-center rounded-xl">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-primary">{t(`start.module.${m.key}.label`)}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-xs leading-snug text-muted-foreground">{t(`start.module.${m.key}.desc`)}</p>
                    <div className="launcher-card-cta mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                      {t("start.myself.open")} <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ──
  const plan = resolveProcess(answers);
  const goalOptions = answers.goal ? CONTEXT_OPTIONS[answers.goal] : [];
  const canNext =
    (step === 1 && !!answers.goal) ||
    (step === 2 && !!answers.context) ||
    (step === 3 && !!answers.depth);

  return (
    <div className="space-y-6">
      <StartHero compact onManual={() => setMode("myself")} />
      <Stepper step={step} />

      <Card>
        <CardContent className="space-y-5 pt-6">
          {step === 1 && (
            <Step title={t("start.step1.title")} subtitle={t("start.step1.subtitle")}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {GOALS.map((g) => {
                  const Icon = GOAL_ICON[g.icon] ?? Sparkles;
                  const tone = GOAL_TONE[g.id] ?? "blue";
                  const active = answers.goal === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setAnswers({ goal: g.id, context: null, depth: null })}
                      className={`launcher-card tone-${tone} p-4 text-left ${active ? "is-selected" : ""}`}
                    >
                      <Icon className="launcher-card-glyph h-16 w-16" strokeWidth={1} aria-hidden />
                      <div className="relative z-10 flex flex-col">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="launcher-card-icon flex h-10 w-10 items-center justify-center rounded-xl">
                            <Icon className="h-5 w-5" />
                          </div>
                          {active && <Check className="launcher-card-tone-text h-4 w-4" />}
                        </div>
                        <h3 className="text-base font-semibold text-primary">{t(`start.goal.${g.id}.label`)}</h3>
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">{t(`start.goal.${g.id}.desc`)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 2 && answers.goal && (
            <Step title={t("start.step2.title")} subtitle={t("start.step2.subtitle")}>
              <div className="grid gap-3">
                {goalOptions.map((o) => (
                  <OptionCard
                    key={o.id}
                    active={answers.context === o.id}
                    title={t(`start.context.${answers.goal}.${o.id}.label`)}
                    desc={t(`start.context.${answers.goal}.${o.id}.desc`)}
                    onClick={() => setAnswers((a) => ({ ...a, context: o.id }))}
                  />
                ))}
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title={t("start.step3.title")} subtitle={t("start.step3.subtitle")}>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["quick", "standard", "certified"] as StartDepth[]).map((d) => (
                  <OptionCard
                    key={d}
                    active={answers.depth === d}
                    title={t(`start.depth.${d}.label`)}
                    desc={t(`start.depth.${d}.hint`)}
                    onClick={() => setAnswers((a) => ({ ...a, depth: d }))}
                  />
                ))}
              </div>
            </Step>
          )}

          {step === 4 && plan && (
            <Recommendation
              plan={plan}
              depth={answers.depth}
              organizations={organizations}
              roleProfiles={roleProfiles}
              araOrgs={araOrgs}
              araVersionId={araVersionId}
              reflectTemplates={reflectTemplates}
              acCompetencies={acCompetencies}
              acExercises={acExercises}
              acRoleProfiles={acRoleProfiles}
            />
          )}

          {/* Nav */}
          <div className="flex items-center justify-between border-t pt-4">
            <button
              onClick={() => (step === 1 ? setMode("fork") : setStep((s) => s - 1))}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> {t("start.back")}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => { setMode("fork"); reset(); }} className="text-xs text-muted-foreground hover:text-foreground">
                {t("start.startOver")}
              </button>
              {step < 4 && (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1.5">
                  {t("start.next")} <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Recommendation step (Step 4): names the requirement + inline-create or handoff ──
function Recommendation({
  plan, depth, organizations, roleProfiles, araOrgs, araVersionId, reflectTemplates,
  acCompetencies, acExercises, acRoleProfiles,
}: {
  plan: ProcessPlan;
  depth: StartDepth | null;
  organizations: { id: string; name: string }[];
  roleProfiles: { id: string; name_en: string }[];
  araOrgs: AraOrg[];
  araVersionId: string | null;
  reflectTemplates: ReflectTemplate[];
  acCompetencies: AcCompetency[];
  acExercises: AcExercise[];
  acRoleProfiles: AcRoleProfile[];
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-[#5391D5]/30 bg-gradient-to-br from-[#5391D5]/10 via-white to-violet-50 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#5391D5]/15 text-[#5391D5]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="ara-eyebrow">{t("start.rec.identified")}</p>
            <h3 className="mt-0.5 text-xl font-bold text-[#010131]">{t(`start.requirement.${plan.requirementKey}`)}</h3>
            <p className="mt-1 text-sm text-[#111232]">{t(`start.rationale.${plan.rationaleKey}`)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t("start.rec.measures")}</span>
          {plan.constructs.map((c) => (
            <span key={c} className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-800">{t(`start.construct.${c}`)}</span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t("start.rec.uses")}</span>
          {plan.instruments.map((i) => (
            <span key={i} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-medium text-slate-700">{t(`start.instrument.${i}`)}</span>
          ))}
          {depth && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800">{t(`start.depth.${depth}.label`)}</span>}
        </div>
      </div>

      {plan.proposed ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t("start.rec.proposedNote")}</div>
      ) : plan.module === "prehire" ? (
        <PrehireInline organizations={organizations} roleProfiles={roleProfiles} depth={depth} />
      ) : plan.module === "ara_org" ? (
        <AraOrgInline araOrgs={araOrgs} araVersionId={araVersionId} />
      ) : plan.module === "reflect" ? (
        <ReflectInline araOrgs={araOrgs} templates={reflectTemplates} />
      ) : plan.module === "ac" ? (
        <AcEngagementInline
          planKey={plan.key}
          organizations={organizations}
          competencies={acCompetencies}
          exercises={acExercises}
          roleProfiles={acRoleProfiles}
        />
      ) : (
        (() => {
          const isLaunch = plan.module === "fluent" || plan.module === "technical" || plan.module === "psychometric";
          return (
            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <p className="text-sm text-muted-foreground">{isLaunch ? t("start.rec.launchCopy") : t("start.rec.handoffCopy")}</p>
              <Link href={plan.createRoute} className="shrink-0">
                <Button className="gap-1.5">{isLaunch ? t("start.rec.launch") : t("start.rec.continue")} <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </div>
          );
        })()
      )}
    </div>
  );
}

// ── Inline Pre-Hire create (Full-B: creates the requisition here, lands in it) ──
function PrehireInline({
  organizations, roleProfiles, depth,
}: {
  organizations: { id: string; name: string }[];
  roleProfiles: { id: string; name_en: string }[];
  depth: StartDepth | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [orgId, setOrgId] = useState("");
  const [roleProfileId, setRoleProfileId] = useState("");
  const [level, setLevel] = useState("");
  const defaultStages =
    depth === "quick" ? { quiz: true, fluent: true, cbi: false } : { quiz: true, fluent: true, cbi: true };
  const [stages, setStages] = useState<Record<string, boolean>>(defaultStages);
  const [submitting, setSubmitting] = useState(false);

  const create = async () => {
    if (!orgId) return toast.error(t("start.prehire.errOrg"));
    const stage_config = PREHIRE_STAGES.filter((s) => stages[s.kind]).map((s) => ({
      kind: s.kind, weight: s.weight, cut_score: s.cut, required: depth === "certified",
    }));
    if (stage_config.length === 0) return toast.error(t("start.prehire.errStage"));
    setSubmitting(true);
    const res = await createRequisitionAction({
      organization_id: orgId,
      title,
      role_profile_id: roleProfileId || null,
      level: level || undefined,
      english_required: stages.fluent,
      stage_config,
    });
    setSubmitting(false);
    if ("error" in res) return toast.error(res.error);
    toast.success(t("start.prehire.created"));
    router.push(`/admin/prehire/${res.data.id}`);
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium text-[#010131]">{t("start.prehire.intro")}</p>
      <div className="space-y-2">
        <Label htmlFor="w-title">{t("start.prehire.roleTitle")}</Label>
        <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("start.prehire.roleTitlePh")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="w-org">{t("start.prehire.clientOrg")}</Label>
          <select id="w-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{t("start.select")}</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-level">{t("start.prehire.level")}</Label>
          <Input id="w-level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder={t("start.prehire.levelPh")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="w-rp">{t("start.prehire.roleProfile")}</Label>
        <select id="w-rp" value={roleProfileId} onChange={(e) => setRoleProfileId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">{t("start.none")}</option>
          {roleProfiles.map((p) => <option key={p.id} value={p.id}>{p.name_en}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>{t("start.prehire.stages")}</Label>
        {PREHIRE_STAGES.map((s) => (
          <label key={s.kind} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
            <Checkbox checked={!!stages[s.kind]} onCheckedChange={() => setStages((st) => ({ ...st, [s.kind]: !st[s.kind] }))} />
            <span className="flex-1">{t(`start.prehire.stage.${s.kind}`)}</span>
            <span className="text-xs text-muted-foreground">{t("start.prehire.weightCut", { weight: s.weight, cut: s.cut })}</span>
          </label>
        ))}
      </div>
      <Button onClick={create} disabled={submitting || !title || !orgId} className="w-full gap-1.5">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitting ? t("start.creating") : t("start.createOpen")}
      </Button>
    </div>
  );
}

// ── Inline ARA org diagnostic (native form posts to the module's own action). ──
function AraOrgInline({ araOrgs, araVersionId }: { araOrgs: AraOrg[]; araVersionId: string | null }) {
  const { t } = useTranslation();
  if (araOrgs.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t("start.ara.noOrgs")}{" "}
        <Link href="/ara/admin/organizations/new" className="font-medium underline">{t("start.ara.addOne")}</Link>, {t("start.ara.orMyself")}
      </div>
    );
  }
  return (
    <form action={startAraAssessmentAction} className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium text-[#010131]">{t("start.ara.intro")}</p>
      <input type="hidden" name="engagement_stage" value="enterprise" />
      <input type="hidden" name="question_bank_version_id" value={araVersionId ?? ""} />
      <input type="hidden" name="default_language" value="en" />
      <div className="space-y-2">
        <Label htmlFor="ara-org">{t("start.ara.organization")}</Label>
        <select id="ara-org" name="organization_id" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="" disabled>{t("start.select")}</option>
          {araOrgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name} — {o.region.toUpperCase()} / {o.sector}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ara-region">{t("start.ara.region")}</Label>
          <select id="ara-region" name="region" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="" disabled>{t("start.select")}</option>
            <option value="uae">{t("start.ara.regionUae")}</option>
            <option value="saudi">{t("start.ara.regionSaudi")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ara-sector">{t("start.ara.sector")}</Label>
          <select id="ara-sector" name="sector" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="" disabled>{t("start.select")}</option>
            <option value="government">{t("start.ara.sectorGov")}</option>
            <option value="banking">{t("start.ara.sectorBank")}</option>
            <option value="general">{t("start.ara.sectorGeneral")}</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("start.ara.note")}</p>
      <Button type="submit" className="w-full gap-1.5"><Check className="h-4 w-4" /> {t("start.createOpen")}</Button>
    </form>
  );
}

// ── Inline Reflect 360 (creates the engagement + framework, lands in it). ──
function ReflectInline({ araOrgs, templates }: { araOrgs: AraOrg[]; templates: ReflectTemplate[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const create = async () => {
    if (!name.trim()) return toast.error(t("start.reflect.errName"));
    setSubmitting(true);
    const framework = templateId
      ? ({ kind: "clone", templateId } as const)
      : ({ kind: "manual", name_en: `${name.trim()} framework` } as const);
    const res = await createReflectEngagement({
      name: name.trim(),
      organization_id: orgId || null,
      default_language: "en",
      report_language: "bilingual",
      anonymity_min_n: 3,
      is_sandbox: false,
      framework,
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(t("start.reflect.created"));
    router.push(`/reflect/consultant/engagements/${res.engagementId}`);
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium text-[#010131]">{t("start.reflect.intro")}</p>
      <div className="space-y-2">
        <Label htmlFor="rf-name">{t("start.reflect.name")}</Label>
        <Input id="rf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("start.reflect.namePh")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rf-org">{t("start.reflect.orgOptional")}</Label>
          <select id="rf-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{t("start.none")}</option>
            {araOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rf-tpl">{t("start.reflect.framework")}</Label>
          <select id="rf-tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={templates.length === 0} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {templates.length === 0
              ? <option value="">{t("start.reflect.blank")}</option>
              : templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{t("start.reflect.clone", { name: tpl.name_en })}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{templateId ? t("start.reflect.noteClone") : t("start.reflect.noteBlank")}</p>
      <Button onClick={create} disabled={submitting || !name.trim()} className="w-full gap-1.5">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitting ? t("start.creating") : t("start.createOpen")}
      </Button>
    </div>
  );
}

// ── Inline AC engagement (the whole competency→exercise→matrix design, inline). ──
function AcEngagementInline({
  planKey, organizations, competencies, exercises, roleProfiles,
}: {
  planKey: string;
  organizations: { id: string; name: string }[];
  competencies: AcCompetency[];
  exercises: AcExercise[];
  roleProfiles: AcRoleProfile[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const defaultName =
    planKey === "ac_development" ? t("start.ac.nameDevelopment")
      : planKey === "ac_succession" ? t("start.ac.nameSuccession")
        : t("start.ac.nameSelection");
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState(defaultName);
  const [targetRole, setTargetRole] = useState("");
  const [comps, setComps] = useState<Set<string>>(new Set());
  const [exos, setExos] = useState<Set<string>>(new Set());
  const [matrix, setMatrix] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const cell = (ex: string, c: string) => `${ex}|${c}`;
  const grouped: { domain: string; items: AcCompetency[] }[] = [];
  for (const c of [...competencies].sort((a, b) => a.domainSort - b.domainSort || a.name.localeCompare(b.name))) {
    const last = grouped[grouped.length - 1];
    if (last && last.domain === c.domain) last.items.push(c);
    else grouped.push({ domain: c.domain, items: [c] });
  }
  const selExos = exercises.filter((e) => exos.has(e.id));
  const selComps = competencies.filter((c) => comps.has(c.id));
  const countFor = (compId: string) => selExos.filter((e) => matrix.has(cell(e.id, compId))).length;

  const toggleComp = (id: string) => {
    setComps((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setMatrix((m) => { const n = new Set(m); for (const e of exercises) n.delete(cell(e.id, id)); return n; });
  };
  const toggleEx = (id: string) => {
    setExos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setMatrix((m) => { const n = new Set(m); for (const c of competencies) n.delete(cell(id, c.id)); return n; });
  };
  const toggleCell = (ex: string, c: string) =>
    setMatrix((m) => { const n = new Set(m); const k = cell(ex, c); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const applyProfile = (pid: string) => {
    const p = roleProfiles.find((x) => x.id === pid);
    if (!p) return;
    const avail = new Set(competencies.map((c) => c.id));
    setComps(new Set(p.competencyIds.filter((id) => avail.has(id)).slice(0, 15)));
    setMatrix(new Set());
  };

  const autoMap = () => {
    const ex = Array.from(exos);
    if (ex.length < 2) { toast.error(t("start.ac.errAutoMap")); return; }
    const next = new Set<string>();
    Array.from(comps).forEach((c, i) => { next.add(cell(ex[i % ex.length], c)); next.add(cell(ex[(i + 1) % ex.length], c)); });
    setMatrix(next);
  };

  const allMapped = selComps.length > 0 && selComps.every((c) => countFor(c.id) >= 2);
  const valid = !!orgId && name.trim().length > 0 && comps.size >= 4 && comps.size <= 15 && exos.size >= 1 && allMapped;

  const create = async () => {
    if (!valid) return;
    setSubmitting(true);
    const res = await createEngagementAction({
      organizationId: orgId,
      name: name.trim(),
      targetRole: targetRole.trim() || undefined,
      competencies: Array.from(comps).map((competencyId) => ({ competencyId, weight: null })),
      exercises: Array.from(exos),
      matrix: Array.from(matrix).map((k) => { const [exerciseId, competencyId] = k.split("|"); return { exerciseId, competencyId }; }),
    });
    setSubmitting(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : t("start.ac.errCreate"));
      return;
    }
    toast.success(t("start.ac.created"));
    const id = "data" in res && res.data ? res.data.id : null;
    router.push(id ? `/admin/engagements/${id}` : "/admin/engagements");
  };

  return (
    <div className="space-y-5 rounded-md border p-4">
      <p className="text-sm font-medium text-[#010131]">{t("start.ac.intro")}</p>

      {/* Basics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ac-org">{t("start.ac.clientOrg")}</Label>
          <select id="ac-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{t("start.select")}</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ac-role">{t("start.ac.targetRole")}</Label>
          <Input id="ac-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder={t("start.ac.targetRolePh")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ac-name">{t("start.ac.name")}</Label>
        <Input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Competencies */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{t("start.ac.competencies")} <span className={comps.size >= 4 && comps.size <= 15 ? "text-emerald-600" : "text-amber-600"}>{t("start.ac.countCap", { n: comps.size })}</span></Label>
          {roleProfiles.length > 0 && (
            <select onChange={(e) => { applyProfile(e.target.value); e.target.value = ""; }} defaultValue="" className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">{t("start.ac.quickFill")}</option>
              {roleProfiles.map((p) => <option key={p.id} value={p.id}>{p.name_en}</option>)}
            </select>
          )}
        </div>
        <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border p-3">
          {grouped.map((g) => (
            <div key={g.domain}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.domain}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {g.items.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={comps.has(c.id)} onCheckedChange={() => toggleComp(c.id)} />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-2">
        <Label>{t("start.ac.exercises")} <span className={exos.size >= 1 ? "text-emerald-600" : "text-amber-600"}>{t("start.ac.count", { n: exos.size })}</span></Label>
        <div className="grid gap-1.5 rounded-md border p-3 sm:grid-cols-2">
          {exercises.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={exos.has(e.id)} onCheckedChange={() => toggleEx(e.id)} />
              <span className="truncate">{e.name}</span>
            </label>
          ))}
          {exercises.length === 0 && <p className="text-xs text-muted-foreground">{t("start.ac.noExercises")}</p>}
        </div>
      </div>

      {/* Matrix */}
      {selComps.length > 0 && selExos.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{t("start.ac.matrix")} <span className="text-xs font-normal text-muted-foreground">{t("start.ac.matrixHint")}</span></Label>
            <button type="button" onClick={autoMap} className="inline-flex items-center gap-1.5 rounded-md border border-[#5391D5] px-2.5 py-1 text-xs font-medium text-[#5391D5] hover:bg-[#5391D5]/5">
              <Sparkles className="h-3.5 w-3.5" /> {t("start.ac.autoMap")}
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 bg-muted/40 px-2 py-2 text-left font-medium">{t("start.ac.colCompetency")}</th>
                  {selExos.map((e) => <th key={e.id} className="min-w-[80px] px-2 py-2 text-center font-medium">{e.name}</th>)}
                  <th className="px-2 py-2 text-center">✓</th>
                </tr>
              </thead>
              <tbody>
                {selComps.map((c) => {
                  const n = countFor(c.id);
                  return (
                    <tr key={c.id} className="border-b">
                      <td className="sticky left-0 bg-card px-2 py-1.5">{c.name}</td>
                      {selExos.map((e) => (
                        <td key={e.id} className="px-2 py-1.5 text-center">
                          <Checkbox checked={matrix.has(cell(e.id, c.id))} onCheckedChange={() => toggleCell(e.id, c.id)} />
                        </td>
                      ))}
                      <td className={`px-2 py-1.5 text-center font-medium ${n >= 2 ? "text-emerald-600" : "text-amber-600"}`}>{n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Button onClick={create} disabled={submitting || !valid} className="w-full gap-1.5">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitting ? t("start.creating") : t("start.createOpen")}
      </Button>
    </div>
  );
}

// ── Small presentational helpers ──

// The landing hero — the ara-hero aurora banner, shared across all modes. Full
// height on the fork/manual screens; compact (one-line) inside the wizard so the
// steps stay the focus. Carries the optional Back / "set it up myself" chips.
function StartHero({ compact, onBack, onManual }: { compact?: boolean; onBack?: () => void; onManual?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={`ara-hero relative overflow-hidden rounded-2xl ${compact ? "px-5 py-5 sm:px-7 sm:py-6" : "px-6 py-8 sm:px-10 sm:py-10"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <span className="ara-eyebrow text-accent">
            <Sparkles className="h-3.5 w-3.5" /> {t("start.hero.kicker")}
          </span>
          {compact ? (
            <h1 className="ara-numeral mt-1.5 text-xl font-semibold leading-tight text-white sm:text-2xl">{t("start.title")}</h1>
          ) : (
            <>
              <h1 className="ara-numeral mt-2 mb-3 text-2xl font-semibold leading-[1.1] text-white sm:text-3xl lg:text-4xl">
                {t("start.hero.lead")} <span className="ara-accent-sweep">{t("start.hero.accent")}</span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-white/75">{t("start.subtitle")}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/55">
                {[t("start.hero.badge1"), t("start.hero.badge2"), t("start.hero.badge3")].map((b, i) => (
                  <span key={b} className="inline-flex items-center gap-4">
                    {i > 0 && <span className="h-3 w-px bg-white/20" />}
                    <span>{b}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        {compact && (onBack || onManual) && (
          <div className="flex shrink-0 items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15">
                <ArrowLeft className="h-3.5 w-3.5" /> {t("start.back")}
              </button>
            )}
            {onManual && (
              <button onClick={onManual} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15">
                <SlidersHorizontal className="h-3.5 w-3.5" /> {t("start.fork.myselfCta")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

// The two front-door choices + the manual-setup module tiles share the launcher
// card look from the root "/" launcher, dressed per-tone.
function ForkCard({
  icon: Icon, tone, title, desc, cta, badge, onClick,
}: {
  icon: LucideIcon;
  tone: Tone; title: string; desc: string; cta: string; badge?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`launcher-card tone-${tone} p-6 text-left`}>
      <Icon className="launcher-card-glyph h-20 w-20" strokeWidth={1} aria-hidden />
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="launcher-card-icon flex h-11 w-11 items-center justify-center rounded-xl">
            <Icon className="h-5 w-5" />
          </div>
          {badge && (
            <span className="launcher-card-chip rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{badge}</span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        <p className="mt-1 flex-1 text-sm leading-snug text-muted-foreground">{desc}</p>
        <div className="launcher-card-cta mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
          {cta} <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}

// A radio-style selectable card for the context (step 2) + rigor (step 3) choices.
function OptionCard({
  active, title, desc, onClick,
}: {
  active: boolean; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-xl border p-4 text-left transition-all ${active ? "border-[#5391D5] bg-[#5391D5]/5 shadow-sm ring-1 ring-[#5391D5]" : "hover:border-[#5391D5]/50 hover:bg-[#5391D5]/[0.03]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[#010131]">{title}</span>
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${active ? "border-[#5391D5] bg-[#5391D5] text-white" : "border-slate-300 text-transparent group-hover:border-[#5391D5]/50"}`}>
          <Check className="h-3 w-3" />
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  const { t } = useTranslation();
  const labels = [t("start.stepper.goal"), t("start.stepper.details"), t("start.stepper.rigor"), t("start.stepper.setup")];
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={l} className="flex flex-1 items-center gap-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors ${active ? "bg-[#5391D5] text-white shadow-sm shadow-[#5391D5]/40" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={`hidden text-xs sm:inline ${active ? "font-semibold text-[#010131]" : "text-muted-foreground"}`}>{l}</span>
            {n < 4 && <span className={`h-px flex-1 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#010131]">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
