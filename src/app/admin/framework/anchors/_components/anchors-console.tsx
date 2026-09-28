"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, X, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BARS_POINT_LABELS } from "@/lib/competencies/framework-definitions";
import { redraftAnchorsAction, reviewAnchorsAction, saveAnchorAction } from "../actions";

export type AnchorRow = {
  id: string;
  scale_point: number;
  anchor_en: string;
  anchor_ar: string;
  source: string;
  sme_status: string;
  sme_reviewer_name: string | null;
};

export type AnchorCompetency = {
  id: string;
  name: string;
  domain: string;
  cluster: string;
  order: [number, number, number];
  anchors: AnchorRow[];
};

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
};

type Filter = "all" | "pending" | "approved" | "rejected" | "missing";

export function AnchorsConsole({ competencies }: { competencies: AnchorCompetency[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [drafts, setDrafts] = useState<Record<string, { en: string; ar: string }>>({});

  const all = competencies.flatMap((c) => c.anchors);
  const count = (s: string) => all.filter((a) => a.sme_status === s).length;
  const missing = competencies.filter((c) => c.anchors.length < 5).length;

  const shown = useMemo(
    () =>
      competencies.filter((c) =>
        filter === "all"
          ? true
          : filter === "missing"
            ? c.anchors.length < 5
            : c.anchors.some((a) => a.sme_status === filter),
      ),
    [competencies, filter],
  );

  const run = (fn: () => Promise<{ error?: string; ok?: true }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(done);
        router.refresh();
      }
    });

  const edited = (a: AnchorRow) => drafts[a.id] && (drafts[a.id].en !== a.anchor_en || drafts[a.id].ar !== a.anchor_ar);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-[#010131]">
          {count("approved")} of {competencies.length * 5} anchors approved
        </span>
        <span className="text-muted-foreground">· {count("pending")} pending · {count("rejected")} rejected{missing ? ` · ${missing} competencies incomplete` : ""}</span>
        <div className="ms-auto flex flex-wrap gap-1">
          {(["all", "pending", "approved", "rejected", "missing"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="h-7 text-xs capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      {shown.map((c) => {
        const pendingIds = c.anchors.filter((a) => a.sme_status !== "approved").map((a) => a.id);
        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {c.domain} · {c.cluster}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || pendingIds.length === 0}
                    onClick={() => run(() => reviewAnchorsAction({ ids: pendingIds, status: "approved" }), `Approved ${pendingIds.length} anchors for ${c.name}`)}
                  >
                    <Check className="me-1 h-3.5 w-3.5" /> Approve all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => redraftAnchorsAction({ competencyId: c.id }), `Redrafted the pending anchors for ${c.name}`)}
                    title="Replaces pending anchors with a fresh AI draft. Approved anchors are never overwritten."
                  >
                    <Sparkles className="me-1 h-3.5 w-3.5" /> {c.anchors.length < 5 ? "Draft with AI" : "Redraft pending"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.anchors.length === 0 && <p className="text-sm text-muted-foreground">No anchors yet.</p>}
              {c.anchors.map((a) => {
                const d = drafts[a.id] ?? { en: a.anchor_en, ar: a.anchor_ar };
                const label = BARS_POINT_LABELS[a.scale_point as 1 | 2 | 3 | 4 | 5];
                return (
                  <div key={a.id} className="grid gap-2 rounded-md border p-3 lg:grid-cols-[160px_1fr_1fr_auto]">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#010131]">
                        {a.scale_point} · {label?.en}
                      </p>
                      <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_TONE[a.sme_status] ?? ""}`}>
                        {a.sme_status}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground">
                        {a.source === "ai_draft" ? "AI draft" : a.source === "sme" ? "SME" : "Edited by VIFM"}
                        {a.sme_reviewer_name ? ` · ${a.sme_reviewer_name}` : ""}
                      </p>
                    </div>
                    <Textarea
                      rows={3}
                      className="text-sm"
                      value={d.en}
                      aria-label={`English anchor for ${a.scale_point}`}
                      onChange={(e) => setDrafts((p) => ({ ...p, [a.id]: { ...d, en: e.target.value } }))}
                    />
                    <Textarea
                      rows={3}
                      dir="rtl"
                      className="text-sm"
                      value={d.ar}
                      aria-label={`Arabic anchor for ${a.scale_point}`}
                      onChange={(e) => setDrafts((p) => ({ ...p, [a.id]: { ...d, ar: e.target.value } }))}
                    />
                    <div className="flex gap-1 lg:flex-col">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || !edited(a)}
                        onClick={() => run(() => saveAnchorAction({ id: a.id, anchorEn: d.en, anchorAr: d.ar }), "Anchor saved; it is pending review again")}
                      >
                        <Save className="me-1 h-3.5 w-3.5" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || a.sme_status === "approved" || !!edited(a)}
                        onClick={() => run(() => reviewAnchorsAction({ ids: [a.id], status: "approved" }), "Anchor approved")}
                      >
                        <Check className="me-1 h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || a.sme_status === "rejected"}
                        onClick={() => run(() => reviewAnchorsAction({ ids: [a.id], status: "rejected" }), "Anchor rejected; assessors no longer see it")}
                      >
                        <X className="me-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
