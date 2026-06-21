"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addPartnerCourseAction, togglePartnerCourseAction, deletePartnerCourseAction } from "../actions";

export type PartnerCourseRow = {
  id: string;
  provider: string;
  provider_label: string | null;
  code: string | null;
  title_en: string;
  title_ar: string | null;
  description_en: string | null;
  cefr_levels: string[] | null;
  focus_skill: string | null;
  url: string | null;
  is_active: boolean;
  sort_order: number | null;
};

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const FOCUS = ["", "reading", "listening", "writing", "speaking", "general"] as const;

const PROVIDER_LABEL: Record<string, string> = { se_academy: "SE Training Academy", vifm: "VIFM" };
function providerLabelOf(r: PartnerCourseRow): string {
  return r.provider_label || PROVIDER_LABEL[r.provider] || r.provider;
}

const inputCls = "w-full";

export function PartnerCoursesManager({ rows }: { rows: PartnerCourseRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    provider: "se_academy",
    provider_label: "",
    code: "",
    title_en: "",
    title_ar: "",
    description_en: "",
    focus_skill: "",
    url: "",
  });
  const [levels, setLevels] = useState<string[]>([]);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleLevel = (b: string) =>
    setLevels((l) => (l.includes(b) ? l.filter((x) => x !== b) : [...l, b]));

  const add = () => {
    if (!form.title_en.trim()) {
      toast.error("A course title is required.");
      return;
    }
    start(async () => {
      const res = await addPartnerCourseAction({
        ...form,
        focus_skill: form.focus_skill || null,
        cefr_levels: levels,
      });
      if (res.ok) {
        toast.success("Course added.");
        setForm({ provider: "se_academy", provider_label: "", code: "", title_en: "", title_ar: "", description_en: "", focus_skill: "", url: "" });
        setLevels([]);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const toggle = (r: PartnerCourseRow) =>
    start(async () => {
      const res = await togglePartnerCourseAction(r.id, !r.is_active);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });

  const remove = (r: PartnerCourseRow) => {
    if (!window.confirm(`Delete "${r.title_en}"? This cannot be undone.`)) return;
    start(async () => {
      const res = await deletePartnerCourseAction(r.id);
      if (res.ok) {
        toast.success("Course deleted.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="mt-6 space-y-8">
      {/* Add form */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold text-[#010131]">Add a partner course</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="provider">Provider</Label>
            <select
              id="provider"
              value={form.provider}
              onChange={set("provider")}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="se_academy">SE Training Academy</option>
              <option value="vifm">VIFM</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <Label htmlFor="provider_label">Provider display name (optional)</Label>
            <Input id="provider_label" className={inputCls} value={form.provider_label} onChange={set("provider_label")} placeholder="e.g. SE Training Academy" />
          </div>
          <div>
            <Label htmlFor="title_en">Course title (EN) *</Label>
            <Input id="title_en" className={inputCls} value={form.title_en} onChange={set("title_en")} placeholder="e.g. Business English - Intermediate" />
          </div>
          <div>
            <Label htmlFor="title_ar">Course title (AR)</Label>
            <Input id="title_ar" className={inputCls} value={form.title_ar} onChange={set("title_ar")} dir="rtl" />
          </div>
          <div>
            <Label htmlFor="code">Code (optional)</Label>
            <Input id="code" className={inputCls} value={form.code} onChange={set("code")} />
          </div>
          <div>
            <Label htmlFor="focus_skill">Skill focus (optional)</Label>
            <select
              id="focus_skill"
              value={form.focus_skill}
              onChange={set("focus_skill")}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {FOCUS.map((f) => (
                <option key={f} value={f}>{f === "" ? "- none -" : f}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>CEFR levels it suits (leave empty for all levels)</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CEFR.map((b) => {
                const on = levels.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleLevel(b)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      on ? "border-accent bg-accent text-white" : "bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="url">Course URL (optional)</Label>
            <Input id="url" className={inputCls} value={form.url} onChange={set("url")} placeholder="https://..." />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description_en">Short description (optional)</Label>
            <Textarea id="description_en" value={form.description_en} onChange={set("description_en")} rows={2} placeholder="One line shown on the report as the recommendation reason." />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={add} disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Add course
          </Button>
        </div>
      </div>

      {/* List */}
      <div>
        <h2 className="mb-2 text-base font-semibold text-[#010131]">Catalogue ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No partner courses yet. Add SE Training Academy&rsquo;s English courses above and they&rsquo;ll start
            appearing on Fluent reports.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[#010131]">{r.title_en}</span>
                    {!r.is_active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">Hidden</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {providerLabelOf(r)}
                    {r.code ? ` · ${r.code}` : ""}
                    {r.cefr_levels && r.cefr_levels.length ? ` · ${r.cefr_levels.join(", ")}` : " · all levels"}
                    {r.focus_skill ? ` · focus: ${r.focus_skill}` : ""}
                  </div>
                  {r.description_en ? <div className="mt-0.5 text-xs text-muted-foreground">{r.description_en}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggle(r)} disabled={pending}>
                    {r.is_active ? "Hide" : "Show"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(r)} disabled={pending} className="text-rose-600 hover:text-rose-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
