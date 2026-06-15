"use client";

import { GraduationCap, Check, ShieldCheck, AlertCircle, Info, Loader2 } from "lucide-react";

/** One "how to answer" line: an optional bold lead-in label + the direction. */
export type IntroPoint = { label?: string; text: string };
export type IntroNote = { tone: "info" | "amber" | "emerald"; text: string };

const NOTE_TONE: Record<IntroNote["tone"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

/**
 * Shared "Before you begin" intro shown before any assessment starts. Gives the
 * taker direction on what is required and how to answer, then a Start button.
 * Self-contained VIFM styling so it reads the same across modules (Technical,
 * Sandbox, ARC, Fluent, candidate quiz). Pass `dir="rtl"` for Arabic sittings.
 */
export function AssessmentIntro({
  eyebrow,
  title,
  intro,
  howToTitle,
  howTo,
  guidance = [],
  note,
  startLabel,
  onStart,
  busy = false,
  dir,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  howToTitle: string;
  howTo: IntroPoint[];
  guidance?: string[];
  note?: IntroNote | null;
  startLabel: string;
  onStart: () => void;
  busy?: boolean;
  dir?: "ltr" | "rtl";
}) {
  const NoteIcon = note?.tone === "emerald" ? ShieldCheck : note?.tone === "amber" ? AlertCircle : Info;
  return (
    <div dir={dir} className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{eyebrow}</p>
        <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
          <GraduationCap className="h-5 w-5 text-[#5391D5]" /> {title}
        </h2>
      </div>

      <p className="text-sm leading-relaxed text-slate-700">{intro}</p>

      {howTo.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{howToTitle}</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {howTo.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5391D5]" />
                <span>
                  {p.label ? (
                    <>
                      <span className="font-semibold">{p.label}:</span> {p.text}
                    </>
                  ) : (
                    p.text
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {guidance.length > 0 && (
        <ul className="space-y-1.5 text-sm text-slate-600">
          {guidance.map((g, i) => (
            <li key={i} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <div className={`flex items-start gap-2 rounded-md border p-3 text-[12px] ${NOTE_TONE[note.tone]}`}>
          <NoteIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{note.text}</span>
        </div>
      )}

      <button
        onClick={onStart}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />} {startLabel}
      </button>
    </div>
  );
}
