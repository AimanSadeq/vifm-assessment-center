"use client";

import { useEffect, useState, useTransition } from "react";
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
      setError("Tick the confirmation to launch.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await launchReflectEngagement(engagementId);
      if (!res.ok) {
        setError(res.error ?? "Launch failed");
        return;
      }
      onLaunched();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Launch</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm the engagement summary and launch. Status flips from <code className="text-xs">draft</code> to <code className="text-xs">live</code> and the engagement appears on your dashboard. Invitation emails to raters land with milestone M3.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <Summary label="Engagement" value={state.name} />
        <Summary label="Sandbox" value={state.is_sandbox ? "Yes" : "No"} />
        <Summary label="Default language" value={state.default_language === "en" ? "English" : "Arabic"} />
        <Summary
          label="Report language"
          value={
            state.report_language === "bilingual"
              ? "Bilingual (EN + AR)"
              : state.report_language === "en"
                ? "English only"
                : "Arabic only"
          }
        />
        <Summary label="Anonymity threshold" value={`N = ${state.anonymity_min_n}`} />
        <Summary
          label="Field window"
          value={
            state.field_window_start && state.field_window_end
              ? `${state.field_window_start} → ${state.field_window_end}`
              : state.field_window_start
                ? `Opens ${state.field_window_start}`
                : "Not set"
          }
        />
        <Summary
          label="Target population"
          value={state.participant_target_count ? `${state.participant_target_count}` : "Not set"}
        />
        <Summary
          label="Levels in scope"
          value={state.levels_in_scope.length === 0 ? "None" : state.levels_in_scope.join(", ")}
        />
        <Summary
          label="Framework"
          value={
            state.framework_kind === "clone"
              ? "Cloned from library template"
              : state.framework_kind === "ai"
                ? "Built via AI extraction (review on detail page)"
                : "Built manually (add competencies on detail page)"
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
              Review the framework before launching
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {framework
                ? `${framework.competencies.length} competencies · ${totalBehaviours} behaviours`
                : "Loading…"}
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
              Download PDF
            </a>
          )}
        </button>

        {frameworkOpen && framework && (
          <div className="border-t bg-muted/20 p-4 space-y-4 max-h-[28rem] overflow-y-auto">
            {framework.competencies.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No competencies yet - the framework is empty.</p>
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
                                AI-proposed
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
              To edit individual behaviours, exit the wizard and use the engagement detail page&apos;s framework section once it ships.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <div className="font-medium">Launching is recoverable</div>
          <div className="text-amber-800 mt-1">
            Launching flips the engagement to <code className="text-xs">live</code>, sends rater invitations
            via Microsoft Graph (or the sandbox redirect when this is a sandbox engagement), and unlocks the
            participant + cohort reports. You can pause or close the engagement later from the detail page.
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
          I&apos;ve reviewed the engagement design and I&apos;m ready to flip it live.
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
              Launching…
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 me-2" />
              Launch engagement
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
