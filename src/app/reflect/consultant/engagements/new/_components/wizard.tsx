"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StepBasics } from "./step-1-basics";
import { StepFramework } from "./step-2-framework";
import { StepLevels } from "./step-3-levels";
import { StepPeople } from "./step-4-people";
import { StepLaunch } from "./step-5-launch";
import { createReflectEngagement } from "@/lib/reflect/actions";
import type {
  ReflectLevelTier,
} from "@/lib/reflect/validations";

export type WizardOrg = {
  id: string;
  name: string;
  name_ar: string | null;
  region: "uae" | "saudi";
  sector: "government" | "banking" | "general";
};

export type WizardTemplate = {
  id: string;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
};

export type FrameworkKind = "clone" | "manual" | "ai";

export type WizardState = {
  // Step 1
  name: string;
  organization_id: string;
  region: "uae" | "saudi" | "";
  sector: "government" | "banking" | "general" | "";
  default_language: "en" | "ar";
  report_language: "en" | "ar" | "bilingual";
  anonymity_min_n: number;
  participant_target_count: number | null;
  field_window_start: string;
  field_window_end: string;
  is_sandbox: boolean;

  // Step 2
  framework_kind: FrameworkKind;
  framework_template_id: string;
  framework_name_en: string;
  framework_name_ar: string;
  framework_source_text: string;

  // Step 3
  levels_in_scope: ReflectLevelTier[];

  // After step 2 → 3 transition
  engagement_id: string | null;
};

const STEPS = [
  { number: 1, labelKey: "reflectWizard.steps.organisation" },
  { number: 2, labelKey: "reflectWizard.steps.framework" },
  { number: 3, labelKey: "reflectWizard.steps.levels" },
  { number: 4, labelKey: "reflectWizard.steps.people" },
  { number: 5, labelKey: "reflectWizard.steps.launch" },
] as const;

type Props = {
  orgs: WizardOrg[];
  templates: WizardTemplate[];
  defaultOrgId?: string;
};

export function ReflectWizard({ orgs: initialOrgs, templates, defaultOrgId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  // Local copy so inline org creation (Step 1) can append without a refetch.
  const [orgs, setOrgs] = useState<WizardOrg[]>(initialOrgs);
  const [state, setState] = useState<WizardState>({
    name: "",
    organization_id: defaultOrgId ?? "",
    region: "",
    sector: "",
    default_language: "en",
    report_language: "bilingual",
    anonymity_min_n: 3,
    participant_target_count: null,
    field_window_start: "",
    field_window_end: "",
    is_sandbox: false,
    framework_kind: "clone",
    framework_template_id: "",
    framework_name_en: "",
    framework_name_ar: "",
    framework_source_text: "",
    levels_in_scope: ["exec", "senior_mgr", "manager"],
    engagement_id: null,
  });
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));

  // ──────────────────────────────────────────────────────────
  // Validation per step
  // ──────────────────────────────────────────────────────────
  const validateStep = (n: 1 | 2 | 3 | 4 | 5): string | null => {
    switch (n) {
      case 1:
        if (!state.name.trim()) return t("reflectWizard.errors.nameRequired");
        if (!state.organization_id) return t("reflectWizard.errors.pickOrganisation");
        if (state.anonymity_min_n < 3) return t("reflectWizard.errors.anonymityMin");
        return null;
      case 2:
        if (state.framework_kind === "clone") {
          if (!state.framework_template_id) return t("reflectWizard.errors.pickTemplate");
        } else if (state.framework_kind === "manual") {
          if (!state.framework_name_en.trim()) return t("reflectWizard.errors.frameworkNameEn");
        } else if (state.framework_kind === "ai") {
          if (!state.framework_name_en.trim()) return t("reflectWizard.errors.frameworkNameEn");
          if (state.framework_source_text.trim().length < 50) {
            return t("reflectWizard.errors.pasteSource");
          }
        }
        return null;
      case 3:
        if (state.levels_in_scope.length === 0) return t("reflectWizard.errors.pickLevel");
        return null;
      case 4:
        // Participants + raters are committed via their own server
        // actions inside step 4. We don't block here - consultant can
        // launch with zero participants in sandbox mode but we warn.
        return null;
      case 5:
        return null;
    }
  };

  // ──────────────────────────────────────────────────────────
  // Step 2 → 3 transition creates the engagement + framework.
  // From step 3 onwards, the wizard works against engagement_id.
  // ──────────────────────────────────────────────────────────
  const submitStep2 = async () => {
    setError(null);
    const v1 = validateStep(1);
    const v2 = validateStep(2);
    if (v1) { setError(v1); return; }
    if (v2) { setError(v2); return; }

    startTransition(async () => {
      const result = await createReflectEngagement({
        name: state.name.trim(),
        organization_id: state.organization_id,
        region: state.region || null,
        sector: state.sector || null,
        default_language: state.default_language,
        report_language: state.report_language,
        anonymity_min_n: state.anonymity_min_n,
        participant_target_count: state.participant_target_count,
        field_window_start: state.field_window_start || null,
        field_window_end: state.field_window_end || null,
        is_sandbox: state.is_sandbox,
        framework:
          state.framework_kind === "clone"
            ? { kind: "clone", templateId: state.framework_template_id }
            : state.framework_kind === "manual"
              ? {
                  kind: "manual",
                  name_en: state.framework_name_en.trim(),
                  name_ar: state.framework_name_ar.trim() || undefined,
                }
              : {
                  kind: "ai",
                  name_en: state.framework_name_en.trim(),
                  name_ar: state.framework_name_ar.trim() || undefined,
                  sourceText: state.framework_source_text.trim(),
                },
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      update({ engagement_id: result.engagementId });
      setStep(3);
    });
  };

  const onNext = async () => {
    setError(null);
    const v = validateStep(step);
    if (v) { setError(v); return; }

    if (step === 2) {
      await submitStep2();
      return;
    }
    setStep((s) => (s < 5 ? ((s + 1) as 1 | 2 | 3 | 4 | 5) : s));
  };

  const onPrev = () => {
    setError(null);
    if (step === 1) return;
    // Once the engagement is created (step 3+), we don't let the user
    // go back to step 1/2 - the framework branch can't be changed
    // once data has been seeded. Allow within 3-5.
    if (state.engagement_id && step <= 3) return;
    setStep((s) => ((s - 1) as 1 | 2 | 3 | 4 | 5));
  };

  const onLaunched = () => {
    if (!state.engagement_id) return;
    router.push(`/reflect/consultant/engagements/${state.engagement_id}`);
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav className="flex flex-wrap gap-2">
        {STEPS.map((s) => {
          const isActive = step === s.number;
          const isDone = step > s.number;
          return (
            <div
              key={s.number}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : isDone
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center text-[10px]",
                  isActive
                    ? "bg-primary-foreground text-primary"
                    : isDone
                      ? "bg-emerald-500 text-white"
                      : "border border-current"
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : s.number}
              </span>
              <span>{t(s.labelKey)}</span>
            </div>
          );
        })}
      </nav>

      {/* Step body */}
      <div className="rounded-xl border bg-card p-6">
        {step === 1 && (
          <StepBasics
            state={state}
            update={update}
            orgs={orgs}
            onOrgCreated={(org) => setOrgs((prev) => [org, ...prev])}
          />
        )}
        {step === 2 && (
          <StepFramework state={state} update={update} templates={templates} />
        )}
        {step === 3 && state.engagement_id && (
          <StepLevels state={state} update={update} engagementId={state.engagement_id} />
        )}
        {step === 4 && state.engagement_id && (
          <StepPeople engagementId={state.engagement_id} />
        )}
        {step === 5 && state.engagement_id && (
          <StepLaunch
            state={state}
            engagementId={state.engagement_id}
            onLaunched={onLaunched}
          />
        )}
      </div>

      {/* Error rail */}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Nav rail (hidden on step 5 - launch button is in StepLaunch itself) */}
      {step !== 5 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={step === 1 || pending || (!!state.engagement_id && step <= 3)}
          >
            <ChevronLeft className="h-4 w-4 me-1" />
            {t("reflectWizard.nav.back")}
          </Button>
          <Button onClick={onNext} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                {step === 2 ? t("reflectWizard.nav.creatingEngagement") : t("reflectWizard.nav.loading")}
              </>
            ) : (
              <>
                {step === 2 ? t("reflectWizard.nav.createAndContinue") : t("reflectWizard.nav.next")}
                <ChevronRight className="h-4 w-4 ms-1" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
