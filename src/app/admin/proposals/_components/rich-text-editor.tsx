"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, Palette, RemoveFormatting } from "lucide-react";

/** Lightweight contentEditable rich-text editor (Bold / Italic / Underline / colour /
 *  size) for the proposal section editor. Emits HTML; the server sanitises it to a strict
 *  inline-formatting allowlist before it is ever rendered (see rich-text.ts). Uncontrolled
 *  after mount (innerHTML set once) so the caret never jumps; remount via `key` to reset. */
export function RichTextEditor({
  initialHtml,
  onChange,
  dir = "ltr",
  placeholder,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  dir?: "ltr" | "rtl";
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const doc = () => document;

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || "";
    try {
      doc().execCommand("styleWithCSS", false, "true");
    } catch {
      /* deprecated but supported; ignore if it throws */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const apply = (cmd: string, value?: string) => {
    ref.current?.focus();
    restoreSelection();
    try {
      doc().execCommand("styleWithCSS", false, "true");
      doc().execCommand(cmd, false, value);
    } catch {
      /* ignore */
    }
    emit();
    saveSelection();
  };

  const btn = "inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5" onMouseDown={(e) => e.preventDefault()}>
        <button type="button" title="Bold" className={btn} onClick={() => apply("bold")}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" title="Italic" className={btn} onClick={() => apply("italic")}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" title="Underline" className={btn} onClick={() => apply("underline")}><Underline className="h-3.5 w-3.5" /></button>
        <label className={`${btn} relative cursor-pointer`} title="Text colour">
          <Palette className="h-3.5 w-3.5" />
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => apply("foreColor", e.target.value)}
          />
        </label>
        <select
          title="Font size"
          defaultValue="3"
          onChange={(e) => { apply("fontSize", e.target.value); e.currentTarget.value = "3"; }}
          className="h-7 rounded border border-border bg-card px-1 text-xs text-muted-foreground"
        >
          <option value="3">Size</option>
          <option value="2">Small</option>
          <option value="4">Large</option>
          <option value="5">X-Large</option>
          <option value="6">Huge</option>
        </select>
        <button type="button" title="Clear formatting" className={`${btn} ml-1`} onClick={() => apply("removeFormat")}><RemoveFormatting className="h-3.5 w-3.5" /></button>
      </div>
      <div
        ref={ref}
        dir={dir}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? ""}
        onInput={emit}
        onBlur={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        className={`prose-editor min-h-[7rem] max-h-[28rem] overflow-auto px-3 py-2 text-sm leading-relaxed focus:outline-none ${dir === "rtl" ? "text-right" : ""}`}
      />
    </div>
  );
}
