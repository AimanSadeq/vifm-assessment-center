"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateReflectBehaviourAction, updateReflectCompetencyAction } from "@/lib/reflect/admin-actions";

type Res = { ok: true } | { ok: false; error: string };

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<Res>, onOk: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success("Saved.");
        onOk();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  return { pending, save };
}

/** Inline editor for a template behaviour's EN/AR wording (the rater question). */
export function EditableBehaviour({
  behaviourId,
  textEn,
  textAr,
}: {
  behaviourId: string;
  textEn: string;
  textAr: string | null;
}) {
  const { pending, save } = useSave();
  const [editing, setEditing] = useState(false);
  const [en, setEn] = useState(textEn);
  const [ar, setAr] = useState(textAr ?? "");

  if (editing) {
    return (
      <div className="flex-1 space-y-1.5">
        <textarea className="w-full rounded border border-input bg-background px-2 py-1 text-sm" rows={2} value={en} onChange={(e) => setEn(e.target.value)} placeholder="English" />
        <textarea dir="rtl" className="w-full rounded border border-input bg-background px-2 py-1 text-xs" rows={2} value={ar} onChange={(e) => setAr(e.target.value)} placeholder="Arabic (MSA)" />
        <div className="flex gap-1.5">
          <button type="button" disabled={pending} onClick={() => save(() => updateReflectBehaviourAction({ behaviourId, text_en: en, text_ar: ar }), () => setEditing(false))}
            className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
          </button>
          <button type="button" disabled={pending} onClick={() => { setEn(textEn); setAr(textAr ?? ""); setEditing(false); }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-50">
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex-1">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="leading-relaxed">{textEn}</div>
          {textAr && <div dir="rtl" className="mt-0.5 text-xs text-muted-foreground/80">{textAr}</div>}
        </div>
        <button type="button" onClick={() => setEditing(true)} title="Edit"
          className="mt-0.5 shrink-0 text-sky-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-sky-800">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Inline editor for a template competency's EN/AR name. */
export function EditableCompetencyName({
  competencyId,
  nameEn,
  nameAr,
}: {
  competencyId: string;
  nameEn: string;
  nameAr: string | null;
}) {
  const { pending, save } = useSave();
  const [editing, setEditing] = useState(false);
  const [en, setEn] = useState(nameEn);
  const [ar, setAr] = useState(nameAr ?? "");

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input className="rounded border border-input bg-background px-2 py-1 text-sm" value={en} onChange={(e) => setEn(e.target.value)} placeholder="Name (EN)" />
        <input dir="rtl" className="rounded border border-input bg-background px-2 py-1 text-sm" value={ar} onChange={(e) => setAr(e.target.value)} placeholder="الاسم (AR)" />
        <button type="button" disabled={pending} onClick={() => save(() => updateReflectCompetencyAction({ competencyId, name_en: en, name_ar: ar }), () => setEditing(false))}
          className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
        </button>
        <button type="button" disabled={pending} onClick={() => { setEn(nameEn); setAr(nameAr ?? ""); setEditing(false); }}
          className="text-[11px] text-muted-foreground disabled:opacity-50">Cancel</button>
      </div>
    );
  }

  return (
    <span className="group inline-flex items-center gap-2">
      <span className="text-base font-semibold text-primary">
        {nameEn}
        {nameAr && <span className="ms-2 text-sm text-muted-foreground" dir="rtl">{nameAr}</span>}
      </span>
      <button type="button" onClick={() => setEditing(true)} title="Edit name"
        className="text-sky-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-sky-800">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
