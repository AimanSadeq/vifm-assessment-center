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
  const [targetCompsEnText, setTargetCompsEnText] = useState(
    initial?.target_competencies_raw_en ? initial.target_competencies_raw_en.join("\n") : ""
  );
  const [objectivesEnText, setObjectivesEnText] = useState(
    initial?.objectives_en ? initial.objectives_en.join("\n") : ""
  );
  const [audienceEn, setAudienceEn] = useState(initial?.audience_en ?? "");
  const [methodologyEn, setMethodologyEn] = useState(initial?.methodology_en ?? "");

  const [pending, start] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      // Both target competencies (block 2) and objectives (block 3)
      // are textareas where each line is one bullet — matches how
      // the PDFs render those blocks (one phrase / one bullet per line).
      const lineToArray = (text: string) => text
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const targetCompsArr = lineToArray(targetCompsEnText);
      const objectivesArr = lineToArray(objectivesEnText);

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
        target_competencies_raw_en: targetCompsArr.length > 0 ? targetCompsArr : null,
        objectives_en: objectivesArr.length > 0 ? objectivesArr : null,
        audience_en: audienceEn || null,
        methodology_en: methodologyEn || null,
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
        <Label htmlFor="overview_en">1 · Course overview</Label>
        <textarea
          id="overview_en"
          rows={4}
          value={overviewEn ?? ""}
          onChange={(e) => setOverviewEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Block 1 — paste the course overview paragraph."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="target_competencies_en">2 · Target competencies</Label>
        <textarea
          id="target_competencies_en"
          rows={5}
          value={targetCompsEnText}
          onChange={(e) => setTargetCompsEnText(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={"Block 2 — one competency phrase per line. e.g.\nDetection Capabilities\nIncident Response\nDigital Forensics\nRisk Mitigation"}
        />
        <p className="text-[11px] text-muted-foreground">
          These are the PDF&apos;s own topical &quot;Target Competencies&quot;
          list (e.g., &quot;Bookkeeping Automation&quot;), kept verbatim
          for audit. The mapping to AC&apos;s 38 behavioural competencies
          and ARA&apos;s 8 pillars is a separate step (Day 3).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="objectives_en">3 · Course objectives</Label>
        <textarea
          id="objectives_en"
          rows={4}
          value={objectivesEnText}
          onChange={(e) => setObjectivesEnText(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={"Block 3 — one objective per line. e.g.\nApply prompt engineering techniques\nCreate content using AI tools\nAnalyse business data with AI"}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audience_en">4 · Target audience</Label>
        <textarea
          id="audience_en"
          rows={3}
          value={audienceEn ?? ""}
          onChange={(e) => setAudienceEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Block 4 — who should attend."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="methodology_en">5 · Course methodology</Label>
        <textarea
          id="methodology_en"
          rows={3}
          value={methodologyEn ?? ""}
          onChange={(e) => setMethodologyEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Block 5 — how the course is delivered (lectures, case studies, hands-on, etc.)."
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
        Six-block order: 1 Overview · 2 Target competencies · 3 Objectives ·
        4 Target audience · 5 Methodology · 6 Detailed outline. Manual form
        captures blocks 1-5; block 6 (the structured outline) needs the
        PDF importer or the block-6 editor that ships in Day 3 alongside
        the AC competency / ARA pillar mapping panel.
      </p>
    </form>
  );
}
