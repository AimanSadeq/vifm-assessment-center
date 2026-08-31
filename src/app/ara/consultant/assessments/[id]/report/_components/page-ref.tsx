"use client";

import { useEffect, useState } from "react";

/**
 * Cross-reference to another page of this report ("Next Steps, page 18").
 *
 * The page a section lands on shifts with engagement stage, pillar count,
 * framework count and roster size, so a page number written at authoring time
 * would be wrong on most runs. This measures the real DOM order instead.
 *
 * Why a client component rather than an inline script: a script that mutated
 * the text before hydration got REVERTED - React re-rendered the server markup
 * over it and logged a text-content mismatch. Rendering the label on the
 * server and appending the number in an effect keeps server and client output
 * identical at hydration time, so the number sticks.
 *
 * The label alone is a correct fallback: if the effect never runs, the
 * reference still reads "see Next Steps", just without the page number.
 */
export function PageRef({
  label,
  targetId,
  word,
}: {
  /** Section name, and the fallback text. */
  label: string;
  /** id of the target element (or of an element inside the target page). */
  targetId: string;
  /** Localized word for "page". */
  word: string;
}) {
  const [pageNumber, setPageNumber] = useState<number | null>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    const section = target?.closest("section.report-page");
    if (!section) return;
    const pages = Array.from(document.querySelectorAll("section.report-page"));
    const index = pages.indexOf(section);
    if (index >= 0) setPageNumber(index + 1);
  }, [targetId]);

  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {pageNumber == null ? label : `${label}, ${word} ${pageNumber}`}
    </span>
  );
}
