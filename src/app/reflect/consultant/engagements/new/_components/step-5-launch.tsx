"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  Rocket,
  Loader2,
  AlertCircle,
  FileDown,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { WizardState } from "./wizard";
import {
  launchReflectEngagement,
  loadReflectFrameworkForEngagement,
  type ReflectFrameworkBundle,
} from "@/lib/reflect/actions";

type Props = {
  state: WizardState;
  engagementId: string;
  onLaunched: () => void;
};

export function StepLaunch({ state, engagementId, onLaunched }: Props) {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [framework, setFramework] = useState<ReflectFrameworkBundle | null>(null);
  const [frameworkOpen, setFrameworkOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadReflectFrameworkForEngagement(engagementId).then((res) => {
      if (!cancelled) setFramework(res);
    });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  const totalBehaviours =
    framework?.competencies.reduce((s, c) => s + c.behaviors.length, 0) ?? 0;

  const launch = () => {
    if (!confirmed) {
      setError(t("reflectWizard.step5.confirmError"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await launchReflectEngagement(engagementId);
      if (!res.ok) {
        setError(res.error ?? t("reflectWizard.step5.launchFailed"));
        return;
      }
      onLaunched();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("reflectWizard.step5.heading")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("reflectWizard.step5.introPrefix")} <code className="text-xs">{t("reflectWizard.step5.statusDraft")}</code> {t("reflectWizard.step5.introMid1")} <code className="text-xs">{t("reflectWizard.step5.statusLive")}</code> {t("reflectWizard.step5.introSuffix")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <Summary label={t("reflectWizard.step5.summary.engagement")} value={state.name} />
        <Summary label={t("reflectWizard.step5.summary.sandbox")} value={state.is_sandbox ? t("reflectWizard.step5.summary.yes") : t("reflectWizard.step5.summary.no")} />
        <Summary label={t("reflectWizard.step5.summary.defaultLanguage")} value={state.default_language === "en" ? t("reflectWizard.step5.summary.english") : t("reflectWizard.step5.summary.arabic")} />
        <Summary
          label={t("reflectWizard.step5.summary.reportLanguage")}
          value={
            state.report_language === "bilingual"
              ? t("reflectWizard.step5.summary.reportBilingual")
              : state.report_language === "en"
                ? t("reflectWizard.step5.summary.reportEnOnly")
                : t("reflectWizard.step5.summary.reportArOnly")
          }
        />
        <Summary label={t("reflectWizard.step5.summary.anonymityThreshold")} value={t("reflectWizard.step5.summary.anonymityValue", { count: state.anonymity_min_n })} />
        <Summary
          label={t("reflectWizard.step5.summary.fieldWindow")}
          value={
            state.field_window_start && state.field_window_end
              ? `${state.field_window_start} → ${state.field_window_end}`
              : state.field_window_start
                ? t("reflectWizard.step5.summary.opens", { date: state.field_window_start })
                : t("reflectWizard.step5.summary.notSet")
          }
        />
        <Summary
          label={t("reflectWizard.step5.summary.targetPopulation")}
          value={state.participant_target_count ? `${state.participant_target_count}` : t("reflectWizard.step5.summary.notSet")}
        />
        <Summary
          label={t("reflectWizard.step5.summary.levelsInScope")}
          value={state.levels_in_scope.length === 0 ? t("reflectWizard.step5.summary.none") : state.levels_in_scope.join(", ")}
        />
        <Summary
          label={t("reflectWizard.step5.summary.framework")}
          value={
            state.framework_kind === "clone"
              ? t("reflectWizard.step5.summary.frameworkClone")
              : state.framework_kind === "ai"
                ? t("reflectWizard.step5.summary.frameworkAi")
                : t("reflectWizard.step5.summary.frameworkManual")
          }
        />
      </div>

      {/* Review framework before launch */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setFrameworkOpen((x) => !x)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        >
          <div>
            <div className="text-sm font-semibold text-primary inline-flex items-center gap-2">
              {frameworkOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
              {t("reflectWizard.step5.reviewToggle")}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {framework
                ? t("reflectWizard.step5.reviewCount", { competencies: framework.competencies.length, behaviours: totalBehaviours })
                : t("reflectWizard.step5.loading")}
            </div>
          </div>
          {framework && (
            <a
              href={`/api/reflect/engagements/${engagementId}/framework.pdf?language=${state.report_language}`}
              onClick={(e) => e.stopPropagation()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              {t("reflectWizard.step5.downloadPdf")}
            </a>
          )}
        </button>

        {frameworkOpen && framework && (
          <div className="border-t bg-muted/20 p-4 space-y-4 max-h-[28rem] overflow-y-auto">
            {framework.competencies.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t("reflectWizard.step5.emptyFramework")}</p>
            ) : (
              framework.competencies.map((c) => (
                <div key={c.id} className="rounded-md border bg-card p-3">
                  <div className="text-sm font-semibold text-primary">
                    {c.name_en}
                    {c.name_ar && <span className="text-muted-foreground"> · {c.name_ar}</span>}
                  </div>
                  {c.description_en && (
                    <p className="text-xs text-muted-foreground mt-1">{c.description_en}</p>
                  )}
                  {c.behaviors.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {c.behaviors.map((b) => (
                        <li key={b.id} className="text-xs leading-relaxed flex items-start gap-2">
                          <span className="mt-1 h-1 w-1 rounded-full bg-accent shrink-0" />
                          <span className="flex-1">
                            {b.text_en}
                            {b.source === "ai_proposed" && (
                              <span className="ms-2 inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200">
                                <Sparkles className="h-2.5 w-2.5" />
                                {t("reflectWizard.step5.aiProposed")}
                              </span>
                            )}
                            {b.text_ar && (
                              <span dir="rtl" className="block text-[11px] text-muted-foreground/80 mt-0.5">
                                {b.text_ar}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
            <p className="text-[11px] text-muted-foreground">
              {t("reflectWizard.step5.editNote")}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <div className="font-medium">{t("reflectWizard.step5.recoverableTitle")}</div>
          <div className="text-amber-800 mt-1">
            {t("reflectWizard.step5.recoverableBodyPrefix")} <code className="text-xs">{t("reflectWizard.step5.statusLive")}</code>{t("reflectWizard.step5.recoverableBodySuffix")}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
        <Checkbox
          id="rf-launch-confirm"
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(Boolean(v))}
        />
        <label htmlFor="rf-launch-confirm" className="text-sm cursor-pointer">
          {t("reflectWizard.step5.confirmLabel")}
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button onClick={launch} disabled={pending || !confirmed} size="lg">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
              {t("reflectWizard.step5.launching")}
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 me-2" />
              {t("reflectWizard.step5.launchEngagement")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-primary mt-1 break-words">{value || "-"}</div>
    </div>
  );
}
