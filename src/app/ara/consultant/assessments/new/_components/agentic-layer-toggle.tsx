"use client";

import { useState } from "react";
import { Bot, ShieldCheck } from "lucide-react";

/**
 * Agentic-AI Readiness layer toggle on the assessment-create wizard.
 *
 * When checked, every org respondent also answers the 18 Agentic-AI
 * Readiness items (6 dimensions) alongside their pillar questions. The
 * client PDF gains an Agentic-AI Readiness section. When unchecked, the
 * assessment runs as a pure org-pillar diagnostic.
 *
 * Distinct from the individual (workforce) layer: that measures how
 * PEOPLE use AI; this measures whether the ORGANISATION can safely
 * delegate to autonomous agents (governance, oversight, risk, access
 * control, autonomy calibration, auditability).
 */
export function AgenticLayerToggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div
      className={`rounded-lg border-2 overflow-hidden transition-colors ${
        enabled
          ? "border-accent/60 bg-accent/5"
          : "border-accent/30 bg-accent/[0.03] hover:bg-accent/[0.06]"
      }`}
    >
      <div className="px-4 pt-4 pb-3 border-b border-accent/20">
        <div className="inline-flex items-center gap-1.5 mb-2">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
            Frontier add-on
          </span>
        </div>
        <p className="text-sm font-semibold text-primary leading-snug">
          The pillars measure readiness to <span className="text-accent">use</span> AI.
          {" "}This measures readiness to <span className="text-accent">delegate</span> to it.
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          As organisations move from using AI to letting autonomous agents take
          actions on their behalf, the question shifts from capability to
          control. This layer assesses six governance dimensions - agent
          accountability, human oversight, failure-mode awareness, tool/data
          access control, autonomy calibration, and auditability.
        </p>
      </div>

      <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          name="include_agentic_layer"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input accent-accent"
        />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-accent" />
            <span className="text-sm font-semibold">
              Add the Agentic-AI Readiness layer to this engagement
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Every respondent will also answer 18 agentic-readiness items
            (~4–6 min) alongside their pillar questions, and the client PDF
            gains an Agentic-AI Readiness section with a cohort score per
            dimension.
          </p>
        </div>
      </label>
    </div>
  );
}
