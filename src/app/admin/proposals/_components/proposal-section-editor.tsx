"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, RotateCcw, Pencil, Save, CheckCircle2 } from "lucide-react";
import type { SectionEditItem } from "@/lib/proposals/section-editor";
import { saveProposalSectionsAction } from "../actions";
import { RichTextEditor } from "./rich-text-editor";

type Field = { value: string; isOverride: boolean };
type Entry = { en: Field; ar: Field; nonce: number };

const hasContent = (html: string) =>
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim().length > 0;
const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();

/** Per-section rich-text editor for a saved proposal. Each section shows its wording
 *  (formatted) with Bold / Italic / Underline / colour / size controls. Editing a section
 *  makes it fixed text; untouched sections stay dynamic (client name, totals and pricing
 *  tables auto-update). Computed sections (pricing, evidence) expose their prose only -
 *  the table stays generated. */
export function ProposalSectionEditor({
  proposalId,
  sections,
}: {
  proposalId: string;
  sections: SectionEditItem[];
}) {
  const router = useRouter();
  const initEntry = (s: SectionEditItem): Entry => ({
    en: { value: s.overrideEn || s.defaultEn, isOverride: !!s.overrideEn },
    ar: { value: s.overrideAr || s.defaultAr, isOverride: !!s.overrideAr },
    nonce: 0,
  });
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(sections.map((s) => [s.title, initEntry(s)])),
  );
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Resilient to the included-section set growing after mount (an optional section ticked
  // in the pricing builder): fall back to the section's own props.
  const entryOf = (s: SectionEditItem): Entry => entries[s.title] ?? initEntry(s);

  const onChange = (s: SectionEditItem, lang: "en" | "ar", html: string) =>
    setEntries((prev) => {
      const e = prev[s.title] ?? initEntry(s);
      return { ...prev, [s.title]: { ...e, [lang]: { value: html, isOverride: true } } };
    });

  const resetSection = (s: SectionEditItem) => {
    setEntries((prev) => {
      const e = prev[s.title] ?? initEntry(s);
      return {
        ...prev,
        [s.title]: {
          en: { value: s.defaultEn, isOverride: false },
          ar: { value: s.defaultAr, isOverride: false },
          nonce: e.nonce + 1, // remount both editors so they reload the default
        },
      };
    });
    setMsg(null);
  };

  const fieldIsCustom = (f: Field) => f.isOverride && hasContent(f.value);
  const isCustomised = (s: SectionEditItem) => {
    const e = entryOf(s);
    return fieldIsCustom(e.en) || fieldIsCustom(e.ar);
  };
  const customisedCount = useMemo(() => sections.filter(isCustomised).length, [entries, sections]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    setMsg(null);
    const overrides: Record<string, { en?: string; ar?: string }> = {};
    for (const s of sections) {
      const e = entryOf(s);
      const en = fieldIsCustom(e.en) ? e.en.value : "";
      const ar = fieldIsCustom(e.ar) ? e.ar.value : "";
      if (en || ar) overrides[s.title] = { ...(en ? { en } : {}), ...(ar ? { ar } : {}) };
    }
    const res = await saveProposalSectionsAction(proposalId, overrides, sections.map((s) => s.title));
    setBusy(false);
    if ("error" in res) return setMsg({ ok: false, text: res.error });
    const n = Object.keys(overrides).length;
    setMsg({ ok: true, text: `Saved. ${n === 0 ? "All sections use the standard wording." : `${n} section${n === 1 ? "" : "s"} customised.`} Re-download the PDF or Word to see the change.` });
    router.refresh();
  }

  const SaveBtn = () => (
    <button
      onClick={save}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-60"
    >
      <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save section text"}
    </button>
  );

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium text-foreground">Proposal content</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every section, with its current wording. Format it (bold, italic, underline, colour, size) before you export.
            Edited sections become fixed text; untouched sections keep updating with the client name, totals and pricing tables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customisedCount > 0 && (
            <span className="rounded-full bg-[#5391D5]/10 px-2.5 py-1 text-xs font-medium text-[#5391D5]">
              {customisedCount} customised
            </span>
          )}
          <SaveBtn />
        </div>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

      <div className="space-y-2">
        {sections.map((s) => {
          const isOpen = !!open[s.title];
          const e = entryOf(s);
          const custom = isCustomised(s);
          const preview = stripTags(e.en.value);
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
                  {preview ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
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
                      ? `This text appears as an intro above ${s.followsNote ?? "the generated content"}, which stays live in the document. Leave blank to omit it.`
                      : "Edit and format the wording for this section. Leave it unchanged to keep it dynamic, or clear it to reset to the standard wording."}
                  </p>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">English</span>
                    <div className="mt-1">
                      <RichTextEditor
                        key={`${s.title}-en-${e.nonce}`}
                        initialHtml={e.en.value}
                        onChange={(html) => onChange(s, "en", html)}
                        placeholder={s.kind === "prepend" ? "Optional intro text (English)…" : "Section wording (English)…"}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Arabic (العربية)</span>
                    <div className="mt-1">
                      <RichTextEditor
                        key={`${s.title}-ar-${e.nonce}`}
                        initialHtml={e.ar.value}
                        onChange={(html) => onChange(s, "ar", html)}
                        dir="rtl"
                        placeholder={s.kind === "prepend" ? "نص تمهيدي اختياري (عربي)…" : "نص القسم (عربي)…"}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">English shows in the EN PDF/Word, Arabic in the AR.</p>
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
        <SaveBtn />
      </div>
    </section>
  );
}
