"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps children in a container that fades + slides up the first time it
 * enters the viewport. Uses IntersectionObserver - no external dep.
 *
 * The visual transition is driven by the .ara-reveal / .is-visible
 * utility classes in globals.css, which also handle prefers-reduced-motion.
 */
export function FadeIn({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  /** Delay (ms) before the reveal runs, for staggered grids. */
  delay?: number;
  /** Optional tag override (defaults to div). */
  as?: "div" | "section" | "article" | "li";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If IO isn't available, show immediately rather than keep it hidden.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const t = window.setTimeout(() => setShown(true), delay);
          io.disconnect();
          return () => window.clearTimeout(t);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  const combined = `ara-reveal ${shown ? "is-visible" : ""} ${className}`.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component: any = Tag;
  return (
    <Component ref={ref} className={combined}>
      {children}
    </Component>
  );
}
