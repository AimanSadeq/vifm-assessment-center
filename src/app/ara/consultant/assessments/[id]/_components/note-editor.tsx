"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateConsultantNote } from "@/lib/ara/consultant-actions";

// NOTES-13: a saved Phase 2 note shows in the language it was written in, with
// the other language underneath, and both can be corrected by hand. The report
// prints exactly what is saved here.
export function NoteEditor({
  noteId,
  assessmentId,
  noteLanguage,
  textEn,
  textAr,
}: {
  noteId: string;
  assessmentId: string;
  noteLanguage: "en" | "ar";
  textEn: string;
  textAr: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [en, setEn] = useState(textEn);
  const [ar, setAr] = useState(textAr ?? "");

  const original = noteLanguage === "ar" ? (textAr ?? textEn) : textEn;
  const other = noteLanguage === "ar" ? textEn : textAr;

  if (!editing) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm whitespace-pre-wrap" dir={noteLanguage === "ar" ? "rtl" : "ltr"}>
          {original}
        </p>
        {other && other !== original ? (
          <p
            className="text-xs whitespace-pre-wrap text-muted-foreground border-s-2 ps-2"
            dir={noteLanguage === "ar" ? "ltr" : "rtl"}
          >
            {other}
          </p>
        ) : (
          <p className="text-xs text-amber-700">
            {noteLanguage === "ar" ? t("araAssessmentDetail.note_no_en") : t("araAssessmentDetail.note_no_ar")}
          </p>
        )}
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
          <Pencil className="me-1 h-3 w-3" /> {t("araAssessmentDetail.note_edit")}
        </Button>
      </div>
    );
  }

  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("note_id", noteId);
      fd.set("assessment_id", assessmentId);
      fd.set("note_text", en);
      fd.set("note_text_ar", ar);
      const r = await updateConsultantNote(fd);
      if (!r.ok) {
        toast.error(r.error ?? t("araAssessmentDetail.note_save_failed"));
        return;
      }
      toast.success(t("araAssessmentDetail.note_saved"));
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`note-en-${noteId}`} className="text-xs">{t("araAssessmentDetail.note_label_en")}</Label>
        <Textarea id={`note-en-${noteId}`} rows={3} value={en} onChange={(e) => setEn(e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`note-ar-${noteId}`} className="text-xs">{t("araAssessmentDetail.note_label_ar")}</Label>
        <Textarea
          id={`note-ar-${noteId}`}
          rows={3}
          dir="rtl"
          value={ar}
          onChange={(e) => setAr(e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" className="h-7 text-xs" disabled={pending || en.trim().length === 0} onClick={save}>
          {t("araAssessmentDetail.note_save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => {
            setEn(textEn);
            setAr(textAr ?? "");
            setEditing(false);
          }}
        >
          {t("araAssessmentDetail.note_cancel")}
        </Button>
      </div>
    </div>
  );
}
