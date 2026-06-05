"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
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
import { GOALS, CONTEXT_OPTIONS, resolveProcess, PROCESS } from "@/lib/start/resolver";
import type { StartGoal, StartDepth, WizardAnswers, ProcessPlan } from "@/lib/start/types";
import { createRequisitionAction } from "@/app/admin/prehire/actions";
import { createReflectEngagement } from "@/lib/reflect/actions";
import { startAraAssessmentAction } from "../actions";

type AraOrg = { id: string; name: string; region: string; sector: string };
type ReflectTemplate = { id: string; name_en: string };

// ── Display copy (v1 English; admin portal renders EN-only at runtime — i18n is a fast-follow) ──
const GOAL_ICON: Record<string, ComponentType<{ className?: string }>> = {
  UserCheck, Sprout, TrendingUp, BadgeCheck, BrainCircuit, Users,
};
const GOAL_META: Record<StartGoal, { label: string; desc: string }> = {
  hire: { label: "Hire or screen candidates", desc: "Evaluate applicants for a role — fast screen or a full selection assessment." },
  develop: { label: "Develop my people", desc: "Grow current employees: development centre, 360 feedback, or learning." },
  succession: { label: "Spot potential & plan succession", desc: "Map a talent pool on a 9-box and gauge readiness for bigger roles." },
  certify: { label: "Certify a capability", desc: "Prove technical, language, or ability/aptitude proficiency." },
  ai_readiness: { label: "Measure AI readiness", desc: "Assess an organization's or an individual's readiness to adopt AI." },
  feedback_360: { label: "Run 360° leadership feedback", desc: "Multi-rater feedback against your leadership behaviours." },
};
const CONTEXT_META: Record<string, { label: string; desc: string }> = {
  "hire.screen_many": { label: "Screen candidates at scale", desc: "A short, self-served screen (quiz + English + AI interview)." },
  "hire.deep_select": { label: "Run a full selection assessment", desc: "An assessment centre with exercises and assessors." },
  "develop.individual": { label: "Individual growth", desc: "Development centre focused on one person's competencies." },
  "develop.leadership_360": { label: "Leadership 360 feedback", desc: "Multi-rater feedback on a leader." },
  "develop.cohort": { label: "Cohort development", desc: "A development centre for a group." },
  "succession.cohort_role": { label: "A pool against a target role", desc: "Assess a cohort and place them on the 9-box." },
  "certify.technical": { label: "Technical / finance knowledge", desc: "Domain knowledge certification." },
  "certify.english": { label: "English language", desc: "CEFR placement (reading/listening/writing/speaking)." },
  "certify.ability": { label: "Cognitive ability / aptitude", desc: "Reasoning + personality (psychometrics)." },
  "ai_readiness.organization": { label: "A whole organization", desc: "Pillar-based org AI-readiness diagnostic." },
  "ai_readiness.individual": { label: "An individual or team", desc: "Personal AI-readiness across four factors." },
  "feedback_360.leader": { label: "A leader", desc: "360 feedback for a single leader." },
};
const DEPTH_META: Record<StartDepth, { label: string; hint: string }> = {
  quick: { label: "Quick screen", hint: "Fast, lightweight, indicative." },
  standard: { label: "Standard", hint: "The usual rigor for most engagements." },
  certified: { label: "Certified / high-stakes", hint: "Maximum rigor; defensible outcome." },
};
const REQUIREMENT_LABEL: Record<string, string> = {
  pre_screen: "Pre-employment screening", selection_ac: "Selection assessment centre",
  dev_centre: "Development centre", talent_review: "Talent review & succession",
  leadership_360: "360° leadership feedback", language_placement: "English language placement",
  technical_cert: "Technical certification", org_ai: "Organizational AI readiness",
  personal_ai: "Personal AI readiness", psychometric: "Psychometric assessment",
};
const RATIONALE: Record<string, string> = {
  prehire: "Self-served, token-linked screening that ranks candidates on a composite — built for volume.",
  ac_selection: "Behavioural evidence from exercises + assessors gives the most defensible selection signal.",
  ac_development: "A development centre surfaces per-competency gaps and feeds an individual development plan.",
  ac_succession: "Scores feed the Talent Map's 9-box and the succession-readiness pipeline.",
  reflect: "Multi-rater frequency ratings against observable leadership behaviours.",
  fluent: "An indicative CEFR placement across the four language skills.",
  technical: "Domain-knowledge items with a documented cut-score for a certifiable result.",
  ara_org: "Pillar-based maturity across the organization, with peer benchmarks.",
  ara_personal: "Four-factor individual AI readiness, self-served or consultant-issued.",
  psychometric: "Cognitive ability + Big-Five personality — the true 'potential' layer (proposed module).",
};
const CONSTRUCT_LABEL: Record<string, string> = {
  knowledge: "Knowledge", language: "Language", behaviour: "Behaviour",
  potential: "Potential", org_readiness: "Org readiness", disposition: "Disposition", ability: "Ability",
};
const INSTRUMENT_LABEL: Record<string, string> = {
  quiz: "Competency quiz", fluent: "Fluent (English)", cbi: "AI interview (CBI)",
  ac_exercises: "AC exercises", talent_map: "Talent Map", reflect_360: "Reflect 360",
  technical: "Technical assessment", ara_org: "AR Compass (org)", ara_personal: "AR Compass (personal)",
  cognitive: "Cognitive battery", personality: "Personality inventory",
};
const MODULE_MENU: { label: string; desc: string; href: string }[] = [
  { label: "Pre-Hire screening", desc: "Quiz + English + AI interview, ranked.", href: "/admin/prehire/new" },
  { label: "Assessment Centre", desc: "Exercises, assessors, wash-up, OAR.", href: "/admin/engagements/new" },
  { label: "AI Readiness (org)", desc: "Pillar-based org diagnostic.", href: "/ara/consultant/assessments/new" },
  { label: "Reflect 360", desc: "Multi-rater leadership feedback.", href: "/reflect/consultant/engagements/new" },
  { label: "Fluent (English)", desc: "CEFR placement test.", href: "/ac/fluent" },
  { label: "Technical certification", desc: "Finance-domain knowledge.", href: "/ac/tech-assessment" },
];

// Pre-Hire inline stage plan (mirrors the requisition form defaults).
const PREHIRE_STAGES: { kind: "quiz" | "fluent" | "cbi"; label: string; weight: number; cut: number }[] = [
  { kind: "quiz", label: "Competency quiz", weight: 0.4, cut: 60 },
  { kind: "fluent", label: "English (Fluent)", weight: 0.3, cut: 50 },
  { kind: "cbi", label: "AI interview", weight: 0.3, cut: 60 },
];

type Mode = "fork" | "wizard" | "myself";
type Props = {
  organizations: { id: string; name: string }[];
  roleProfiles: { id: string; name_en: string }[];
  araOrgs: AraOrg[];
  araVersionId: string | null;
  reflectTemplates: ReflectTemplate[];
};

export function GuidedStart({ organizations, roleProfiles, araOrgs, araVersionId, reflectTemplates }: Props) {
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
            title="Guide me"
            desc="Answer a few questions — we'll identify the requirement and set up the right process for you."
            cta="Start the wizard"
            onClick={() => { setMode("wizard"); reset(); }}
            primary
          />
          <ForkCard
            icon={<SlidersHorizontal className="h-6 w-6" />}
            title="Set it up myself"
            desc="Go straight to a module's own create flow — nothing about those changes."
            cta="Choose a module"
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
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_MENU.map((m) => (
            <Link key={m.href} href={m.href} className="group rounded-lg border p-4 transition-colors hover:border-[#5391D5] hover:bg-[#5391D5]/5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#010131]">{m.label}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-[#5391D5]" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
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
            <Step title="What do you want to do?" subtitle="Pick the outcome — we'll map it to the right process.">
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
                        <span className="font-medium text-[#010131]">{GOAL_META[g.id].label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{GOAL_META[g.id].desc}</p>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 2 && answers.goal && (
            <Step title="Tell us a bit more" subtitle="This narrows it to the exact process.">
              <div className="grid gap-3">
                {goalOptions.map((o) => {
                  const meta = CONTEXT_META[`${answers.goal}.${o.id}`];
                  const active = answers.context === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setAnswers((a) => ({ ...a, context: o.id }))}
                      className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-[#5391D5] bg-[#5391D5]/5 ring-1 ring-[#5391D5]" : "hover:border-[#5391D5]/50"}`}
                    >
                      <span className="font-medium text-[#010131]">{meta?.label ?? o.id}</span>
                      {meta?.desc && <p className="mt-1 text-xs text-muted-foreground">{meta.desc}</p>}
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="How rigorous does it need to be?" subtitle="Drives the depth and which tier we use.">
              <div className="grid gap-3 sm:grid-cols-3">
                {(["quick", "standard", "certified"] as StartDepth[]).map((d) => {
                  const active = answers.depth === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setAnswers((a) => ({ ...a, depth: d }))}
                      className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-[#5391D5] bg-[#5391D5]/5 ring-1 ring-[#5391D5]" : "hover:border-[#5391D5]/50"}`}
                    >
                      <span className="font-medium text-[#010131]">{DEPTH_META[d].label}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{DEPTH_META[d].hint}</p>
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
            />
          )}

          {/* Nav */}
          <div className="flex items-center justify-between border-t pt-4">
            <button
              onClick={() => (step === 1 ? setMode("fork") : setStep((s) => s - 1))}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => { setMode("fork"); reset(); }} className="text-xs text-muted-foreground hover:text-foreground">
                Start over
              </button>
              {step < 4 && (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1.5">
                  Next <ArrowRight className="h-4 w-4" />
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
}: {
  plan: ProcessPlan;
  depth: StartDepth | null;
  organizations: { id: string; name: string }[];
  roleProfiles: { id: string; name_en: string }[];
  araOrgs: AraOrg[];
  araVersionId: string | null;
  reflectTemplates: ReflectTemplate[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#5391D5]/30 bg-[#5391D5]/5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5391D5]">Identified requirement</p>
        <h3 className="mt-0.5 text-lg font-bold text-[#010131]">{REQUIREMENT_LABEL[plan.requirementKey] ?? plan.requirementKey}</h3>
        <p className="mt-1 text-sm text-[#111232]">{RATIONALE[plan.rationaleKey]}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="text-muted-foreground">Measures:</span>
          {plan.constructs.map((c) => (
            <span key={c} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-800">{CONSTRUCT_LABEL[c] ?? c}</span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="text-muted-foreground">Uses:</span>
          {plan.instruments.map((i) => (
            <span key={i} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">{INSTRUMENT_LABEL[i] ?? i}</span>
          ))}
          {depth && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">{DEPTH_META[depth].label}</span>}
        </div>
      </div>

      {plan.proposed ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          This module is on the roadmap (see the psychometrics proposal) and isn&apos;t built yet — but the
          requirement is correctly identified. Use &quot;Set it up myself&quot; for an available instrument in the meantime.
        </div>
      ) : plan.module === "prehire" ? (
        <PrehireInline organizations={organizations} roleProfiles={roleProfiles} depth={depth} />
      ) : plan.module === "ara_org" ? (
        <AraOrgInline araOrgs={araOrgs} araVersionId={araVersionId} />
      ) : plan.module === "reflect" ? (
        <ReflectInline araOrgs={araOrgs} templates={reflectTemplates} />
      ) : (
        (() => {
          const isLaunch = plan.module === "fluent" || plan.module === "technical";
          const isAc = plan.module === "ac";
          return (
            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <p className="text-sm text-muted-foreground">
                {isLaunch
                  ? "We'll open the assessment runner — ready to go."
                  : isAc
                    ? "An assessment centre needs its full competency & exercise design, so we'll open the 5-step builder for you to complete."
                    : "We'll open this module's create flow, ready for you to configure."}
              </p>
              <Link href={plan.createRoute} className="shrink-0">
                <Button className="gap-1.5">{isLaunch ? "Launch" : "Continue"} <ArrowRight className="h-4 w-4" /></Button>
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
    if (!orgId) return toast.error("Pick a client organization.");
    const stage_config = PREHIRE_STAGES.filter((s) => stages[s.kind]).map((s) => ({
      kind: s.kind, weight: s.weight, cut_score: s.cut, required: depth === "certified",
    }));
    if (stage_config.length === 0) return toast.error("Pick at least one stage.");
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
    toast.success("Requisition created.");
    router.push(`/admin/prehire/${res.data.id}`);
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium text-[#010131]">Set up your screening — we&apos;ll create it and take you straight in.</p>
      <div className="space-y-2">
        <Label htmlFor="w-title">Role title</Label>
        <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Relationship Manager" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="w-org">Client organization</Label>
          <select id="w-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select…</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-level">Level (optional)</Label>
          <Input id="w-level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. Mid / Senior" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="w-rp">Role profile (optional)</Label>
        <select id="w-rp" value={roleProfileId} onChange={(e) => setRoleProfileId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">None</option>
          {roleProfiles.map((p) => <option key={p.id} value={p.id}>{p.name_en}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Stages</Label>
        {PREHIRE_STAGES.map((s) => (
          <label key={s.kind} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
            <Checkbox checked={!!stages[s.kind]} onCheckedChange={() => setStages((st) => ({ ...st, [s.kind]: !st[s.kind] }))} />
            <span className="flex-1">{s.label}</span>
            <span className="text-xs text-muted-foreground">weight {s.weight} · cut {s.cut}</span>
          </label>
        ))}
      </div>
      <Button onClick={create} disabled={submitting || !title || !orgId} className="w-full gap-1.5">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitting ? "Creating…" : "Create & open"}
      </Button>
    </div>
  );
}

// ── Inline ARA org diagnostic (Full-B: a native form posts straight to the
//    module's own action, which creates a draft and redirects you into it). ──
function AraOrgInline({ araOrgs, araVersionId }: { araOrgs: AraOrg[]; araVersionId: string | null }) {
  if (araOrgs.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No AR Compass organizations yet.{" "}
        <Link href="/ara/admin/organizations/new" className="font-medium underline">Add one</Link>, then come back —
        or use &quot;Set it up myself&quot;.
      </div>
    );
  }
  return (
    <form action={startAraAssessmentAction} className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium text-[#010131]">
        Set up the organizational diagnostic — we&apos;ll create a draft and open it so you can finish (pillars, respondents).
      </p>
      <input type="hidden" name="engagement_stage" value="enterprise" />
      <input type="hidden" name="question_bank_version_id" value={araVersionId ?? ""} />
      <input type="hidden" name="default_language" value="en" />
      <div className="space-y-2">
        <Label htmlFor="ara-org">Organization</Label>
        <select id="ara-org" name="organization_id" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="" disabled>Select…</option>
          {araOrgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name} — {o.region.toUpperCase()} / {o.sector}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ara-region">Region</Label>
          <select id="ara-region" name="region" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="" disabled>Select…</option>
            <option value="uae">United Arab Emirates</option>
            <option value="saudi">Saudi Arabia</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ara-sector">Sector</Label>
          <select id="ara-sector" name="sector" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="" disabled>Select…</option>
            <option value="government">Government</option>
            <option value="banking">Banking</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Created at Enterprise scope (all 8 pillars). You can change the stage, pillars and layers after it opens.
      </p>
      <Button type="submit" className="w-full gap-1.5"><Check className="h-4 w-4" /> Create &amp; open</Button>
    </form>
  );
}

// ── Inline Reflect 360 (Full-B: creates the engagement + framework via the
//    module's own action, then lands you in it to add raters & launch). ──
function ReflectInline({ araOrgs, templates }: { araOrgs: AraOrg[]; templates: ReflectTemplate[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const create = async () => {
    if (!name.trim()) return toast.error("Give the engagement a name.");
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
    toast.success("Reflect 360 engagement created.");
    router.push(`/reflect/consultant/engagements/${res.engagementId}`);
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium text-[#010131]">
        Set up the 360 — we&apos;ll create it and open it so you can add raters and launch.
      </p>
      <div className="space-y-2">
        <Label htmlFor="rf-name">Engagement name</Label>
        <Input id="rf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Leadership 360 — Ahmad" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rf-org">Organization (optional)</Label>
          <select id="rf-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">None</option>
            {araOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rf-tpl">Framework</Label>
          <select id="rf-tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={templates.length === 0} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {templates.length === 0
              ? <option value="">Blank (build it after)</option>
              : templates.map((tpl) => <option key={tpl.id} value={tpl.id}>Clone: {tpl.name_en}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {templateId ? "We'll clone the chosen leadership framework — editable after it opens." : "A blank framework is created for you to build."}
      </p>
      <Button onClick={create} disabled={submitting || !name.trim()} className="w-full gap-1.5">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitting ? "Creating…" : "Create & open"}
      </Button>
    </div>
  );
}

// ── Small presentational helpers ──
function Header() {
  return (
    <div>
      <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-[#010131]">
        <Sparkles className="h-6 w-6 text-[#5391D5]" /> Start an assessment
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Let the wizard identify the right process for you — or set it up yourself. Your existing module flows are unchanged.
      </p>
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
  const labels = ["Goal", "Details", "Rigor", "Set up"];
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
