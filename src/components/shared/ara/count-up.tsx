"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated numeric counter that eases from 0 to the target on mount.
 *
 * - If `value` is a non-numeric string (e.g. "27–60"), it renders verbatim.
 * - Respects `prefers-reduced-motion` (jumps straight to the final value).
 * - Runs once; safe to render inside RSC-driven pages.
 */
export function CountUp({
  value,
  duration = 1500,
  className,
}: {
  value: number | string;
  duration?: number;
  className?: string;
}) {
  const targetNumeric = typeof value === "number" ? value : null;
  const [current, setCurrent] = useState(targetNumeric === null ? 0 : 0);
  const started = useRef(false);

  useEffect(() => {
    if (targetNumeric === null) return;
    if (started.current) return;
    started.current = true;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setCurrent(targetNumeric);
      return;
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * targetNumeric));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetNumeric, duration]);

  if (targetNumeric === null) {
    return <span className={className}>{value}</span>;
  }
  return <span className={className}>{current}</span>;
}
