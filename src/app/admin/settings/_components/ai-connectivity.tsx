"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { AiConnectivityResult } from "@/lib/ai/connectivity";
import { checkAiConnectivityAction } from "../actions";

const KIND_LABEL: Record<Exclude<AiConnectivityResult, { ok: true }>["kind"], string> = {
  not_configured: "Not configured",
  auth: "Invalid API key",
  permission: "Permission denied",
  model: "Model not available",
  billing: "Out of credit",
  bad_request: "Request rejected",
  rate_limit: "Rate limited",
  overloaded: "API overloaded",
  server: "API server error",
  network: "Network",
  unknown: "Unexpected error",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function AiConnectivity({ configured, model }: { configured: boolean; model: string }) {
  const [result, setResult] = useState<AiConnectivityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await checkAiConnectivityAction();
      if ("error" in res) setError(res.error);
      else setResult(res.result);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Sends one tiny request to <span className="font-mono">{model}</span> with the same key every AI feature uses
          (Fluent scoring, Techno knowledge generation, the AI interviewer, report writing). Costs a fraction of a cent.
        </p>
        <Button size="sm" onClick={run} disabled={pending || !configured} className="shrink-0">
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-1.5 h-3.5 w-3.5" />}
          {pending ? "Checking" : "Run check"}
        </Button>
      </div>

      {!configured && (
        <p className="text-xs text-amber-700">ANTHROPIC_API_KEY is not set on this server, so there is nothing to check.</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && result.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-800">AI is reachable</span>
            <Badge variant="outline" className="text-[10px]">{result.model}</Badge>
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            Replied in {result.latencyMs} ms, {result.inputTokens} input and {result.outputTokens} output tokens. Checked {fmtTime(result.checkedAt)}.
          </p>
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-800">{KIND_LABEL[result.kind]}</span>
            {result.httpStatus != null && <Badge variant="outline" className="text-[10px]">HTTP {result.httpStatus}</Badge>}
            <Badge variant="outline" className="text-[10px]">{result.model}</Badge>
          </div>
          <p className="mt-1 text-xs text-red-800">{result.hint}</p>
          <p className="mt-2 break-words font-mono text-[11px] text-red-700/80">{result.message}</p>
          <p className="mt-1 text-[11px] text-red-700/70">
            Failed after {result.latencyMs} ms. Checked {fmtTime(result.checkedAt)}.
          </p>
        </div>
      )}
    </div>
  );
}
