"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateAllCompetencyEvidence } from "@/lib/ac/evidence-actions";
import { generateAllQuestionEvidence } from "@/lib/ara/actions";
import { generateAllEvidence } from "@/lib/evidence/actions";

/**
 * One-tap bulk evidence drafting. Each tap auto-loops: it calls the
 * batched server action repeatedly (6 items/round) until nothing is
 * left, showing live progress. Batching keeps every request well under a
 * hosted serverless timeout, so this works from the deployed site on a
 * phone. Everything is saved as 'ai_proposed' — a human still verifies
 * in the console before anything reaches a client.
 */

type Kind = "ac" | "arc" | "fluent" | "technical" | "reflect" | "psy";
type Result = { ok: boolean; processed?: number; failed?: number; remaining?: number; error?: string };

const LABEL: Record<Kind, string> = {
  ac: "Generate AI drafts — AC competencies",
  arc: "Generate AI drafts — ARC questions",
  fluent: "Generate AI drafts — Fluent (English)",
  technical: "Generate AI drafts — Technical Cert",
  reflect: "Generate AI drafts — Reflect 360",
  psy: "Generate AI drafts — Psychometrics",
};

function runBatch(kind: Kind): Promise<Result> {
  switch (kind) {
    case "ac":
      return generateAllCompetencyEvidence({ batchSize: 6 });
    case "arc":
      return generateAllQuestionEvidence({ batchSize: 6 });
    default:
      return generateAllEvidence(kind, { batchSize: 6 });
  }
}

export function BulkEvidenceButtons({ show = ["ac"] }: { show?: Kind[] }) {
  const router = useRouter();
  const [running, setRunning] = useState<Kind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(kind: Kind) {
    setRunning(kind);
    setMsg("Starting…");
    let total = 0;
    let guard = 0;
    try {
      while (guard++ < 500) {
        const r: Result = await runBatch(kind);

        if (!r.ok) {
          setMsg(`Stopped: ${r.error ?? "unknown error"}`);
          break;
        }
        total += r.processed ?? 0;
        const remaining = r.remaining ?? 0;
        setMsg(`Drafted ${total}… ${remaining} left`);

        // No progress this round → either finished, or every item is
        // failing (usually a missing server API key). Stop either way.
        if ((r.processed ?? 0) === 0) {
          if (remaining > 0 && (r.failed ?? 0) > 0) {
            setMsg(`Stopped after ${total}: ${r.failed} failed this round (check the server's ANTHROPIC_API_KEY). ${remaining} left.`);
          } else {
            setMsg(total > 0 ? `Done — ${total} drafted. Review & verify below.` : "Nothing to draft — all items already have evidence.");
          }
          break;
        }
        if (remaining <= 0) {
          setMsg(`Done — ${total} drafted. Review & verify below.`);
          break;
        }
      }
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(null);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 mb-6">
      <p className="text-sm font-semibold mb-1">Bulk draft generation</p>
      <p className="text-xs text-muted-foreground mb-3">
        One tap drafts research anchors for every item that has none (saved as <strong>AI proposed</strong> —
        nothing reaches a client until you verify it). Runs in small batches with live progress; keep this page
        open until it says <em>Done</em>.
      </p>
      <div className="flex flex-wrap gap-2">
        {show.map((k) => (
          <Button key={k} onClick={() => run(k)} disabled={running !== null} size="sm">
            {running === k ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
            )}
            {LABEL[k]}
          </Button>
        ))}
      </div>
      {msg && <p className="text-xs mt-3 text-foreground/80">{msg}</p>}
    </div>
  );
}
