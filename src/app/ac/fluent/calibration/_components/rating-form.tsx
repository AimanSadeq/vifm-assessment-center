"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { submitHumanRating } from "../actions";

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function CefrSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-[#5391D5] focus:outline-none"
      >
        <option value="">-</option>
        {CEFR.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RatingForm({
  resultId,
  writingHuman,
  speakingHuman,
  hasSpeaking,
}: {
  resultId: string;
  writingHuman: string | null;
  speakingHuman: string | null;
  hasSpeaking: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [rater, setRater] = useState("");
  const [w, setW] = useState(writingHuman ?? "");
  const [s, setS] = useState(speakingHuman ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const r = localStorage.getItem("fluent-rater");
      if (r) setRater(r);
    } catch {
      /* ignore */
    }
  }, []);

  async function save() {
    setBusy(true);
    setErr("");
    setSaved(false);
    const fd = new FormData();
    fd.set("resultId", resultId);
    fd.set("raterId", rater.trim());
    if (w) fd.set("writing_cefr", w);
    if (s) fd.set("speaking_cefr", s);
    const res = await submitHumanRating(fd);
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      try {
        localStorage.setItem("fluent-rater", rater.trim());
      } catch {
        /* ignore */
      }
      router.refresh();
    } else {
      setErr(res.error ?? t("acFluent.ratingSaveFailed"));
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
      <input
        value={rater}
        onChange={(e) => setRater(e.target.value)}
        placeholder={t("acFluent.ratingRaterPlaceholder")}
        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-[#5391D5] focus:outline-none"
      />
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t("acFluent.ratingHumanCefr")}</span>
      <CefrSelect value={w} onChange={setW} label={t("acFluent.skillWriting")} />
      {hasSpeaking && <CefrSelect value={s} onChange={setS} label={t("acFluent.skillSpeaking")} />}
      <button
        onClick={save}
        disabled={busy || !rater.trim() || (!w && !s)}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#121140] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        {t("acFluent.ratingSaveButton")}
      </button>
      {saved && <span className="text-xs text-emerald-600">{t("acFluent.ratingSaved")}</span>}
      {err && (
        <span className="inline-flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5" /> {err}
        </span>
      )}
    </div>
  );
}
