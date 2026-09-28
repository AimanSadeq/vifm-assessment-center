"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, X, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addExerciseExampleAction, draftExerciseExamplesAction, reviewExerciseExampleAction } from "../actions";

// B19 (BPS 4.24, recommended): examples of what the evidence of a competency
// looks like IN this exercise, shown to assessors when they record an
// observation. Drafts stay labelled as drafts on that screen until approved.

export type ExerciseExampleRow = {
  id: string;
  competency_id: string;
  polarity: "positive" | "negative";
  example_en: string;
  sme_status: string;
  source: string;
};

const TONE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
};

export function ExerciseExamplesPanel({
  exerciseId,
  competencies,
  examples,
  commonlyObserved,
}: {
  exerciseId: string;
  competencies: { id: string; name: string }[];
  examples: ExerciseExampleRow[];
  /** Competencies this exercise has observed in engagements - offered first. */
  commonlyObserved: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const first = commonlyObserved[0] ?? competencies[0]?.id ?? "";
  const [compId, setCompId] = useState(first);
  const [text, setText] = useState("");
  const [polarity, setPolarity] = useState<"positive" | "negative">("positive");

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(done);
        router.refresh();
      }
    });

  const ordered = [
    ...competencies.filter((c) => commonlyObserved.includes(c.id)),
    ...competencies.filter((c) => !commonlyObserved.includes(c.id)),
  ];
  const withExamples = ordered.filter((c) => examples.some((e) => e.competency_id === c.id));
  const nameOf = new Map(competencies.map((c) => [c.id, c.name]));

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Indicator examples for assessors</CardTitle>
        <p className="text-xs text-muted-foreground">
          What good and poor evidence of a competency looks like in THIS exercise (BPS clause 4.24). Assessors see these
          when they record an observation. Drafts are labelled as drafts until approved.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1 space-y-1">
            <p className="text-xs font-medium">Competency</p>
            <Select value={compId} onValueChange={setCompId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ordered.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {commonlyObserved.includes(c.id) ? " (observed here)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={pending || !compId}
            onClick={() => run(() => draftExerciseExamplesAction({ exerciseId, competencyId: compId }), `Drafted examples for ${nameOf.get(compId)}`)}
          >
            <Sparkles className="me-1 h-4 w-4" /> Draft with AI
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Select value={polarity} onValueChange={(v) => setPolarity(v as "positive" | "negative")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Input className="min-w-[260px] flex-1" placeholder="Write an example of what an assessor might see in this exercise" value={text} onChange={(e) => setText(e.target.value)} />
          <Button
            variant="outline"
            disabled={pending || !compId || text.trim().length < 8}
            onClick={() =>
              run(async () => {
                const r = await addExerciseExampleAction({ exerciseId, competencyId: compId, polarity, exampleEn: text });
                if (!r.error) setText("");
                return r;
              }, "Example added")
            }
          >
            <Plus className="me-1 h-4 w-4" /> Add
          </Button>
        </div>

        {withExamples.length === 0 && <p className="text-sm text-muted-foreground">No examples for this exercise yet.</p>}
        {withExamples.map((c) => (
          <div key={c.id} className="space-y-1.5">
            <p className="text-sm font-semibold text-[#010131]">{c.name}</p>
            {examples
              .filter((e) => e.competency_id === c.id)
              .map((e) => (
                <div key={e.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                  <span className={e.polarity === "positive" ? "text-green-700" : "text-red-600"}>{e.polarity === "positive" ? "+" : "−"}</span>
                  <span className="flex-1">{e.example_en}</span>
                  <Badge variant="outline" className={`text-[10px] capitalize ${TONE[e.sme_status] ?? ""}`}>
                    {e.sme_status}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 px-2" disabled={pending || e.sme_status === "approved"} title="Approve" onClick={() => run(() => reviewExerciseExampleAction({ id: e.id, status: "approved" }), "Example approved")}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" disabled={pending || e.sme_status === "rejected"} title="Reject" onClick={() => run(() => reviewExerciseExampleAction({ id: e.id, status: "rejected" }), "Example rejected")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" disabled={pending} title="Delete" onClick={() => run(() => reviewExerciseExampleAction({ id: e.id, status: "delete" }), "Example deleted")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
