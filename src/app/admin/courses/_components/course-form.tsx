"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
import { parseOutlineText, outlineToText } from "./outline-parser";

type Props =
  | { mode: "create" }
  | { mode: "edit"; course: VifmCourse };

const LEVELS: { value: VifmCourseLevel; labelKey: string }[] = [
  { value: "foundation", labelKey: "adminCourses.form.levelFoundation" },
  { value: "intermediate", labelKey: "adminCourses.form.levelIntermediate" },
  { value: "advanced", labelKey: "adminCourses.form.levelAdvanced" },
];

export function CourseForm(props: Props) {
  const router = useRouter();
  const { t } = useTranslation();
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
  const [outlineEnText, setOutlineEnText] = useState(outlineToText(initial?.outline_en));
  const [noteEn, setNoteEn] = useState(initial?.note_en ?? "");

  const [pending, start] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      // Both target competencies (block 2) and objectives (block 3)
      // are textareas where each line is one bullet - matches how
      // the PDFs render those blocks (one phrase / one bullet per line).
      const lineToArray = (text: string) => text
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const targetCompsArr = lineToArray(targetCompsEnText);
      const objectivesArr = lineToArray(objectivesEnText);
      const outlineParsed = parseOutlineText(outlineEnText);

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
        outline_en: outlineParsed.length > 0 ? outlineParsed : null,
        note_en: noteEn.trim() ? noteEn : null,
        is_active: initial?.is_active ?? true,
      });
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string"
          ? result.error
          : t("adminCourses.form.validationFailed");
        toast.error(msg);
        return;
      }
      if ("data" in result && result.data) {
        toast.success(props.mode === "create" ? t("adminCourses.form.courseCreated") : t("adminCourses.form.courseSaved"));
        router.push(`/admin/courses/${result.data.id}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title_en">{t("adminCourses.form.titleEn")}</Label>
          <Input id="title_en" required value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title_ar">{t("adminCourses.form.titleAr")}</Label>
          <Input id="title_ar" dir="rtl" value={titleAr ?? ""} onChange={(e) => setTitleAr(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code">{t("adminCourses.form.code")}</Label>
          <Input id="code" value={code ?? ""} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="certification_code">{t("adminCourses.form.certificationCode")}</Label>
          <Input id="certification_code" value={certificationCode ?? ""} onChange={(e) => setCertificationCode(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vertical">{t("adminCourses.form.vertical")}</Label>
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
          <Label htmlFor="level">{t("adminCourses.form.level")}</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as VifmCourseLevel)}>
            <SelectTrigger id="level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{t(l.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="min_duration">{t("adminCourses.form.minDuration")}</Label>
          <Input
            id="min_duration" type="number" step="0.5" min="0.5" max="20"
            value={minDuration}
            onChange={(e) => setMinDuration(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="default_duration">{t("adminCourses.form.defaultDuration")}</Label>
          <Input
            id="default_duration" type="number" step="0.5" min="0.5" max="20"
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_duration">{t("adminCourses.form.maxDuration")}</Label>
          <Input
            id="max_duration" type="number" step="0.5" min="0.5" max="20"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="overview_en">{t("adminCourses.form.block1Label")}</Label>
        <textarea
          id="overview_en"
          rows={4}
          value={overviewEn ?? ""}
          onChange={(e) => setOverviewEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("adminCourses.form.block1Placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="target_competencies_en">{t("adminCourses.form.block2Label")}</Label>
        <textarea
          id="target_competencies_en"
          rows={5}
          value={targetCompsEnText}
          onChange={(e) => setTargetCompsEnText(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("adminCourses.form.block2Placeholder")}
        />
        <p className="text-[11px] text-muted-foreground">
          {t("adminCourses.form.block2Help")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="objectives_en">{t("adminCourses.form.block3Label")}</Label>
        <textarea
          id="objectives_en"
          rows={4}
          value={objectivesEnText}
          onChange={(e) => setObjectivesEnText(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("adminCourses.form.block3Placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audience_en">{t("adminCourses.form.block4Label")}</Label>
        <textarea
          id="audience_en"
          rows={3}
          value={audienceEn ?? ""}
          onChange={(e) => setAudienceEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("adminCourses.form.block4Placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="methodology_en">{t("adminCourses.form.block5Label")}</Label>
        <textarea
          id="methodology_en"
          rows={3}
          value={methodologyEn ?? ""}
          onChange={(e) => setMethodologyEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("adminCourses.form.block5Placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="outline_en">{t("adminCourses.form.block6Label")}</Label>
        <textarea
          id="outline_en"
          rows={14}
          value={outlineEnText}
          onChange={(e) => setOutlineEnText(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          placeholder={[
            t("adminCourses.form.block6PlaceholderL1"),
            t("adminCourses.form.block6PlaceholderL2"),
            t("adminCourses.form.block6PlaceholderL3"),
            t("adminCourses.form.block6PlaceholderL4"),
            "",
            t("adminCourses.form.block6PlaceholderL5"),
            t("adminCourses.form.block6PlaceholderL6"),
          ].join("\n")}
        />
        <p className="text-[11px] text-muted-foreground">
          {t("adminCourses.form.block6HelpA")} <code>#</code> {t("adminCourses.form.block6HelpB")}{" "}
          <code>##</code> {t("adminCourses.form.block6HelpC")} <code>-</code> {t("adminCourses.form.block6HelpD")}
          {" "}<code>-</code> {t("adminCourses.form.block6HelpE")} <em>{t("adminCourses.form.block6HelpOr")}</em> {t("adminCourses.form.block6HelpF")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note_en">{t("adminCourses.form.block7Label")}</Label>
        <textarea
          id="note_en"
          rows={3}
          value={noteEn}
          onChange={(e) => setNoteEn(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("adminCourses.form.block7Placeholder")}
        />
        <p className="text-[11px] text-muted-foreground">
          {t("adminCourses.form.block7Help")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !titleEn.trim()}>
          {pending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
          {props.mode === "create" ? t("adminCourses.form.createBtn") : t("adminCourses.form.saveBtn")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/courses")}>
          {t("adminCourses.cancel")}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("adminCourses.form.blockOrderFootnote")}
      </p>
    </form>
  );
}
