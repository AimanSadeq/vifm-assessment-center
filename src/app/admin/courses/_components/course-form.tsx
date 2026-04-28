"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  VIFM_VERTICAL_LABELS,
  type VifmCourse,
  type VifmCourseLevel,
  type VifmVertical,
} from "@/types/database";
import { upsertCourseAction } from "../actions";

type Props =
  | { mode: "create" }
  | { mode: "edit"; course: VifmCourse };

const LEVELS: { value: VifmCourseLevel; label: string }[] = [
  { value: "foundation", label: "Foundation" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export function CourseForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.course : null;

  const [titleEn, setTitleEn] = useState(initial?.title_en ?? "");
  const [titleAr, setTitleAr] = useState(initial?.title_ar ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [vertical, setVertical] = useState<VifmVertical>(initial?.vertical ?? "leadership");
  const [level, setLevel] = useState<VifmCourseLevel>(initial?.level ?? "intermediate");
  const [certificationCode, setCertificationCode] = useState(initial?.certification_code ?? "");
  const [defaultDuration, setDefaultDuration] = useState(initial?.default_duration_days ?? 5);
  const [minDuration, setMinDuration] = useState(initial?.min_duration_days ?? 2);
  const [maxDuration, setMaxDuration] = useState(initial?.max_duration_days ?? 5);
  const [overviewEn, setOverviewEn] = useState(initial?.overview_en ?? "");
  const [audienceEn, setAudienceEn] = useState(initial?.audience_en ?? "");

  const [pending, start] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await upsertCourseAction({
        id: initial?.id,
        title_en: titleEn,
        title_ar: titleAr || null,
        code: code || null,
        vertical,
        level,
        certification_code: certificationCode || null,
        default_duration_days: Number(defaultDuration),
        min_duration_days: Number(minDuration),
        max_duration_days: Number(maxDuration),
        delivery_modes: initial?.delivery_modes ?? ["classroom", "virtual"],
        languages: initial?.languages ?? ["en"],
        overview_en: overviewEn || null,
        audience_en: audienceEn || null,
        is_active: initial?.is_active ?? true,
      });
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string"
          ? result.error
          : "Validation failed — check your inputs.";
        toast.error(msg);
        return;
      }
      if ("data" in result && result.data) {
        toast.success(props.mode === "create" ? "Course created" : "Course saved");
        router.push(`/admin/courses/${result.data.id}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title_en">Title (English) *</Label>
          <Input id="title_en" required value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title_ar">Title (Arabic)</Label>
          <Input id="title_ar" dir="rtl" value={titleAr ?? ""} onChange={(e) => setTitleAr(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code">Code (e.g. CAIP, PMP)</Label>
          <Input id="code" value={code ?? ""} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="certification_code">Certification code</Label>
          <Input id="certification_code" value={certificationCode ?? ""} onChange={(e) => setCertificationCode(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vertical">Vertical *</Label>
          <Select value={vertical} onValueChange={(v) => setVertical(v as VifmVertical)}>
            <SelectTrigger id="vertical">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VIFM_VERTICAL_LABELS) as VifmVertical[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {VIFM_VERTICAL_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="level">Level</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as VifmCourseLevel)}>
            <SelectTrigger id="level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="min_duration">Min duration (days)</Label>
          <Input
            id="min_duration" type="number" step="0.5" min="0.5" max="20"
            value={minDuration}
            onChange={(e) => setMinDuration(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="default_duration">Default duration (days)</Label>
          <Input
            id="default_duration" type="number" step="0.5" min="0.5" max="20"
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_duration">Max duration (days)</Label>
          <Input
            id="max_duration" type="number" step="0.5" min="0.5" max="20"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="overview_en">Course overview</Label>
        <textarea
          id="overview_en"
          rows={4}
          value={overviewEn ?? ""}
          onChange={(e) => setOverviewEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Block 1 — paste the course overview paragraph here."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audience_en">Target audience</Label>
        <textarea
          id="audience_en"
          rows={3}
          value={audienceEn ?? ""}
          onChange={(e) => setAudienceEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Block 3 — who should attend."
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !titleEn.trim()}>
          {pending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
          {props.mode === "create" ? "Create course" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/courses")}>
          Cancel
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Day 1 form covers identity + duration + the easy text blocks. Day 2
        adds the AI-extraction path that pulls all six blocks from a PDF
        automatically; Day 3 adds the competency / pillar mapping panel.
      </p>
    </form>
  );
}
