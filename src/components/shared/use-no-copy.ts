"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy deterrent for timed test content (Ali, 10 Oct 2026: questions were
 * pasted into a chatbot during the pilot). Spread `guard` on the container
 * that holds the questions and give it `select-none`: copy, cut, right-click
 * and drag are cancelled and text cannot be selected. `notice` is true for a few seconds after an
 * attempt so the screen can say why nothing was copied.
 *
 * A deterrent only: it cannot stop a photo of the screen or retyping.
 */
export function useNoCopy() {
  const [notice, setNotice] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const block = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    setNotice(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(false), 4000);
  }, []);

  return {
    notice,
    guard: {
      onCopy: block,
      onCut: block,
      onContextMenu: block,
      onDragStart: block,
    },
  };
}
