"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// B19 (BPS 4.31) - what each point of the 1-5 scale means for ONE competency.
// Shown beside the rating control so every assessor reads a score the same way.
// Collapsed, it shows only the anchor for the score chosen (or, before a
// score, points 1 / 3 / 5); expanded, the full five-point scale. Anchors not
// yet approved by a subject-matter expert are labelled as drafts.

export type ScaleAnchor = {
  scale_point: number;
  anchor_en: string;
  anchor_ar: string | null;
  sme_status: string;
};

export function ScaleAnchors({
  anchors,
  selected,
  lang = "en",
  barsLabel,
}: {
  anchors: ScaleAnchor[];
  selected?: number | null;
  lang?: "en" | "ar";
  barsLabel: (score: number) => string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (anchors.length === 0) return null;
  const sorted = [...anchors].sort((a, b) => a.scale_point - b.scale_point);
  const draft = sorted.some((a) => a.sme_status !== "approved");
  const visible = open ? sorted : sorted.filter((a) => (selected ? a.scale_point === selected : [1, 3, 5].includes(a.scale_point)));
  const text = (a: ScaleAnchor) => (lang === "ar" && a.anchor_ar ? a.anchor_ar : a.anchor_en);

  return (
    <div className="rounded-md border border-[#5391D5]/30 bg-[#5391D5]/5 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-[#010131]">{t("assessorPortal.observation.rate.anchorsTitle")}</p>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[10px] text-[#5391D5] hover:underline">
          {open ? t("assessorPortal.observation.rate.anchorsHide") : t("assessorPortal.observation.rate.anchorsShow")}
        </button>
      </div>
      <ul className="space-y-1">
        {visible.map((a) => (
          <li
            key={a.scale_point}
            className={cn(
              "grid grid-cols-[auto_1fr] gap-2 rounded px-1.5 py-1 text-[11px] leading-snug",
              selected === a.scale_point ? "bg-white ring-1 ring-[#5391D5]" : "text-muted-foreground",
            )}
          >
            <span className="font-semibold tabular-nums text-[#010131]">
              {a.scale_point} · {barsLabel(a.scale_point)}
            </span>
            <span className="col-span-2">{text(a)}</span>
          </li>
        ))}
      </ul>
      {draft && <p className="text-[10px] text-amber-700">{t("assessorPortal.observation.rate.anchorsDraft")}</p>}
    </div>
  );
}
