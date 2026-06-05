"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { toast } from "sonner";
import {
  Wand2, SlidersHorizontal, ArrowLeft, ArrowRight, Check, Sparkles, Loader2, ExternalLink,
  UserCheck, Sprout, TrendingUp, BadgeCheck, BrainCircuit, Users,
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

// Icons + data only — all copy comes from the start.* i18n namespace.
const GOAL_ICON: Record<string, ComponentType<{ className?: string }>> = {
  UserCheck, Sprout, TrendingUp, BadgeCheck, BrainCircuit, Users,
};
const MODULE_MENU: { key: string; href: string }[] = [
  { key: "prehire", href: "/admin/prehire/new" },
  { key: "ac", href: "/admin/engagements/new" },
  { key: "ara", href: "/ara/consultant/assessments/new" },
  { key: "reflect", href: "/reflect/consultant/engagements/new" },
  { key: "fluent", href: "/ac/fluent" },
  { key: "technical", href: "/ac/tech-assessment" },
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
      <div className="space-y-6">
        <Header />
        <div className="grid gap-4 sm:grid-cols-2">
          <ForkCard
            icon={<Wand2 className="h-6 w-6" />}
            title={t("start.fork.guideTitle")}
            desc={t("start.fork.guideDesc")}
            cta={t("start.fork.guideCta")}
            onClick={() => { setMode("wizard"); reset(); }}
            primary
          />
          <ForkCard
            icon={<SlidersHorizontal className="h-6 w-6" />}
            title={t("start.fork.myselfTitle")}
            desc={t("start.fork.myselfDesc")}
            cta={t("start.fork.myselfCta")}
            onClick={() => setMode("myself")}
          />
        </div>
      </div>
    );
  }

  // ── "Set it up myself" — links to the existing (untouched) create flows ──
  if (mode === "myself") {
    return (
      <div className="space-y-6">
        <Header />
        <button onClick={() => setMode("fork")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("start.back")}
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_MENU.map((m) => (
            <Link key={m.href} href={m.href} className="group rounded-lg border p-4 transition-colors hover:border-[#5391D5] hover:bg-[#5391D5]/5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#010131]">{t(`start.module.${m.key}.label`)}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-[#5391D5]" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t(`start.module.${m.key}.desc`)}</p>
            </Link>
          ))}
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
      <Header />
      <Stepper step={step} />

      <Card>
        <CardContent className="space-y-5 pt-6">
          {step === 1 && (
            <Step title={t("start.step1.title")} subtitle={t("start.step1.subtitle")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {GOALS.map((g) => {
                  const Icon = GOAL_ICON[g.icon] ?? Sparkles;
                  const active = answers.goal === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setAnswers({ goal: g.id, context: null, depth: null })}
                      className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-[#5391D5] bg-[#5391D5]/5 ring-1 ring-[#5391D5]" : "hover:border-[#5391D5]/50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-[#5391D5]" />
                        <span className="font-medium text-[#010131]">{t(`start.goal.${g.id}.label`)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t(`start.goal.${g.id}.desc`)}</p>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 2 && answers.goal && (
            <Step title={t("start.step2.title")} subtitle={t("start.step2.subtitle")}>
              <div className="grid gap-3">
                {goalOptions.map((o) => {
                  const active = answers.context === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setAnswers((a) => ({ ...a, context: o.id }))}
                      className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-[#5391D5] bg-[#5391D5]/5 ring-1 ring-[#5391D5]" : "hover:border-[#5391D5]/50"}`}
                    >
                      <span className="font-medium text-[#010131]">{t(`start.context.${answers.goal}.${o.id}.label`)}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{t(`start.context.${answers.goal}.${o.id}.desc`)}</p>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title={t("start.step3.title")} subtitle={t("start.step3.subtitle")}>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["quick", "standard", "certified"] as StartDepth[]).map((d) => {
                  const active = answers.depth === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setAnswers((a) => ({ ...a, depth: d }))}
                      className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-[#5391D5] bg-[#5391D5]/5 ring-1 ring-[#5391D5]" : "hover:border-[#5391D5]/50"}`}
                    >
                      <span className="font-medium text-[#010131]">{t(`start.depth.${d}.label`)}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{t(`start.depth.${d}.hint`)}</p>
                    </button>
                  );
                })}
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
      <div className="rounded-lg border border-[#5391D5]/30 bg-[#5391D5]/5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5391D5]">{t("start.rec.identified")}</p>
        <h3 className="mt-0.5 text-lg font-bold text-[#010131]">{t(`start.requirement.${plan.requirementKey}`)}</h3>
        <p className="mt-1 text-sm text-[#111232]">{t(`start.rationale.${plan.rationaleKey}`)}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="text-muted-foreground">{t("start.rec.measures")}</span>
          {plan.constructs.map((c) => (
            <span key={c} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-800">{t(`start.construct.${c}`)}</span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="text-muted-foreground">{t("start.rec.uses")}</span>
          {plan.instruments.map((i) => (
            <span key={i} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">{t(`start.instrument.${i}`)}</span>
          ))}
          {depth && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">{t(`start.depth.${depth}.label`)}</span>}
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
          const isLaunch = plan.module === "fluent" || plan.module === "technical";
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
function Header() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-[#010131]">
        <Sparkles className="h-6 w-6 text-[#5391D5]" /> {t("start.title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("start.subtitle")}</p>
    </div>
  );
}

function ForkCard({
  icon, title, desc, cta, onClick, primary,
}: {
  icon: React.ReactNode; title: string; desc: string; cta: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl border p-6 text-left transition-colors ${primary ? "border-[#5391D5] bg-[#5391D5]/5 hover:bg-[#5391D5]/10" : "hover:border-[#5391D5]/50"}`}
    >
      <span className={`grid h-11 w-11 place-items-center rounded-lg ${primary ? "bg-[#5391D5] text-white" : "bg-slate-100 text-slate-600"}`}>{icon}</span>
      <span className="text-lg font-semibold text-[#010131]">{title}</span>
      <span className="text-sm text-muted-foreground">{desc}</span>
      <span className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${primary ? "text-[#5391D5]" : "text-slate-600"}`}>
        {cta} <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  const { t } = useTranslation();
  const labels = [t("start.stepper.goal"), t("start.stepper.details"), t("start.stepper.rigor"), t("start.stepper.setup")];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={l} className="flex items-center gap-2">
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${active ? "bg-[#5391D5] text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={`text-xs ${active ? "font-semibold text-[#010131]" : "text-muted-foreground"}`}>{l}</span>
            {n < 4 && <span className="mx-1 h-px w-6 bg-slate-200" />}
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
