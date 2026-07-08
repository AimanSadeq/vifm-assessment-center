"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, RotateCcw, Pencil, Save, CheckCircle2 } from "lucide-react";
import type { SectionEditItem } from "@/lib/proposals/section-editor";
import { saveProposalSectionsAction } from "../actions";

type Vals = Record<string, { en: string; ar: string }>;

/** Per-section wording editor for a saved proposal. Each section shows its current
 *  text; an Edit toggle reveals EN + AR boxes pre-filled with that wording. Only
 *  sections whose text you actually change are stored as overrides - untouched
 *  sections stay dynamic (client name, totals and pricing tables auto-update). */
export function ProposalSectionEditor({
  proposalId,
  sections,
}: {
  proposalId: string;
  sections: SectionEditItem[];
}) {
  const router = useRouter();
  // Pre-fill for a section: the existing override, else its dynamic default.
  const preFill = (s: SectionEditItem) => ({ en: s.overrideEn || s.defaultEn, ar: s.overrideAr || s.defaultAr });
  const [vals, setVals] = useState<Vals>(() => Object.fromEntries(sections.map((s) => [s.title, preFill(s)])));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Current value for a section, resilient to the included-section set growing after mount
  // (e.g. an optional section ticked in the pricing builder) - vals may not have it yet.
  const valOf = (s: SectionEditItem) => vals[s.title] ?? preFill(s);
  // The value that means "no override" for a section (dynamic default).
  const baseFor = (s: SectionEditItem) => ({
    en: s.kind === "replace" ? s.defaultEn.trim() : "",
    ar: s.kind === "replace" ? s.defaultAr.trim() : "",
  });
  // A field is an override iff it is non-empty AND differs from the dynamic default.
  const fieldOverride = (v: string, base: string) => {
    const t = v.trim();
    return t !== "" && t !== base ? t : "";
  };
  const isCustomised = (s: SectionEditItem) => {
    const base = baseFor(s);
    const v = valOf(s);
    return !!fieldOverride(v.en, base.en) || !!fieldOverride(v.ar, base.ar);
  };

  const customisedCount = useMemo(() => sections.filter(isCustomised).length, [vals, sections]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (s: SectionEditItem, lang: "en" | "ar", value: string) =>
    setVals((prev) => ({ ...prev, [s.title]: { ...(prev[s.title] ?? preFill(s)), [lang]: value } }));

  const resetSection = (s: SectionEditItem) => {
    setVals((prev) => ({ ...prev, [s.title]: { en: s.defaultEn, ar: s.defaultAr } }));
    setMsg(null);
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    const overrides: Record<string, { en?: string; ar?: string }> = {};
    for (const s of sections) {
      const base = baseFor(s);
      const v = valOf(s);
      const en = fieldOverride(v.en, base.en);
      const ar = fieldOverride(v.ar, base.ar);
      if (en || ar) overrides[s.title] = { ...(en ? { en } : {}), ...(ar ? { ar } : {}) };
    }
    const res = await saveProposalSectionsAction(proposalId, overrides, sections.map((s) => s.title));
    setBusy(false);
    if ("error" in res) return setMsg({ ok: false, text: res.error });
    const n = Object.keys(overrides).length;
    setMsg({ ok: true, text: `Saved. ${n === 0 ? "All sections use the standard wording." : `${n} section${n === 1 ? "" : "s"} customised.`} Re-download the PDF or Word to see the change.` });
    router.refresh();
  }

  const rowsFor = (v: string) => Math.min(22, Math.max(5, v.split("\n").length + 1));

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium text-foreground">Proposal content</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every section, with its current wording. Edit any before you export - changed sections become fixed text;
            untouched sections keep updating with the client name, totals and pricing tables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customisedCount > 0 && (
            <span className="rounded-full bg-[#5391D5]/10 px-2.5 py-1 text-xs font-medium text-[#5391D5]">
              {customisedCount} customised
            </span>
          )}
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save section text"}
          </button>
        </div>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

      <div className="space-y-2">
        {sections.map((s) => {
          const isOpen = !!open[s.title];
          const custom = isCustomised(s);
          const v = valOf(s);
          const previewText = v.en.trim();
          return (
            <div key={s.title} className={`rounded-md border ${custom ? "border-[#5391D5]/40 bg-[#5391D5]/[0.03]" : "border-border"}`}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [s.title]: !p[s.title] }))}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">{s.number}.</span> {s.title}
                </span>
                {custom && (
                  <span className="rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[11px] font-medium text-[#5391D5]">Customised</span>
                )}
                {s.kind === "prepend" && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">intro note</span>
                )}
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Pencil className="h-3 w-3" /> {isOpen ? "Close" : "Edit"}
                </span>
              </button>

              {!isOpen && (
                <div className="px-3 pb-2.5 pl-9">
                  {previewText ? (
                    <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{previewText}</p>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Standard wording{s.kind === "prepend" && s.followsNote ? ` - add an optional intro above ${s.followsNote}` : ""}.
                    </p>
                  )}
                </div>
              )}

              {isOpen && (
                <div className="space-y-3 border-t border-border px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    {s.kind === "prepend"
                      ? `This text appears as an intro above ${s.followsNote ?? "the generated content"}, which stays in the document. Leave blank to omit it.`
                      : "Edit the wording for this section. Leave it unchanged to keep it dynamic, or clear it to reset to the standard wording."}
                  </p>
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-muted-foreground">English</span>
                    <textarea
                      value={v.en}
                      onChange={(e) => set(s, "en", e.target.value)}
                      rows={rowsFor(v.en)}
                      placeholder={s.kind === "prepend" ? "Optional intro text (English)…" : "Section wording (English)…"}
                      className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-muted-foreground">Arabic (العربية)</span>
                    <textarea
                      dir="rtl"
                      value={v.ar}
                      onChange={(e) => set(s, "ar", e.target.value)}
                      rows={rowsFor(v.ar)}
                      placeholder={s.kind === "prepend" ? "نص تمهيدي اختياري (عربي)…" : "نص القسم (عربي)…"}
                      className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-right text-sm leading-loose"
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Bullet lines start with &ldquo;- &rdquo;. Blank line = new paragraph. English shows in the EN PDF/Word, Arabic in the AR.
                    </p>
                    <button
                      type="button"
                      onClick={() => resetSection(s)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset to standard
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        {msg?.ok && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save section text"}
        </button>
      </div>
    </section>
  );
}
