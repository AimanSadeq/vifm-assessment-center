"use client";

import { useState, useTransition } from "react";
import { Rocket, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { WizardState } from "./wizard";
import { launchReflectEngagement } from "@/lib/reflect/actions";

type Props = {
  state: WizardState;
  engagementId: string;
  onLaunched: () => void;
};

export function StepLaunch({ state, engagementId, onLaunched }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const launch = () => {
    if (!confirmed) {
      setError("Tick the confirmation to launch.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await launchReflectEngagement(engagementId);
      if (!res.ok) {
        setError(res.error);
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

      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <div className="font-medium">Email delivery lands in M3</div>
          <div className="text-amber-800 mt-1">
            Launching now flips the engagement to <code className="text-xs">live</code> and is fully recoverable.
            Once M3 ships, invitations + reminders will be sent from this point. For sandbox engagements, all email goes to the sandbox redirect address.
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
      <div className="text-sm text-primary mt-1 break-words">{value || "—"}</div>
    </div>
  );
}
