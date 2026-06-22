"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Compass, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { ARC_DEMO_STEPS } from "./arc-demo-steps";
import { DEMO_LS, DEMO_STEP_LS, DEMO_EVENT, isArcDemoOn, setArcDemo } from "./arc-demo-state";

/**
 * Guided-demo rail for the ARC portal (BD trial). A fixed bottom rail that
 * overlays the real /ara screens and walks a presenter through the ARC roadmap.
 *
 * Activation: the "Start guided demo" flip switch (staff-only, consultant
 * dashboard) or `?demo=1` on any /ara page. State lives in localStorage so it
 * survives navigation; the rail + switch stay in sync via DEMO_EVENT. Off by
 * default, so real visitors never see it. Non-destructive: only navigates.
 */

const TOTAL = ARC_DEMO_STEPS.length;
const clamp = (n: number) => Math.min(Math.max(n, 0), TOTAL - 1);

export function GuidedDemoRail() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0); // 0-based

  useEffect(() => {
    if (typeof window === "undefined") return;
    const evaluate = () => {
      const params = new URLSearchParams(window.location.search);
      const on = params.get("demo") === "1" || isArcDemoOn();
      setActive(on);
      if (!on) return;
      if (params.get("demo") === "1") window.localStorage.setItem(DEMO_LS, "1");
      const sp = params.get("step");
      if (sp && /^\d+$/.test(sp)) setStep(clamp(parseInt(sp, 10) - 1));
      else {
        const ss = window.localStorage.getItem(DEMO_STEP_LS);
        if (ss && /^\d+$/.test(ss)) setStep(clamp(parseInt(ss, 10)));
      }
    };
    evaluate();
    window.addEventListener(DEMO_EVENT, evaluate);
    return () => window.removeEventListener(DEMO_EVENT, evaluate);
  }, [pathname]);

  useEffect(() => {
    if (active && typeof window !== "undefined") window.localStorage.setItem(DEMO_STEP_LS, String(step));
  }, [active, step]);

  const goToStep = useCallback(
    (i: number) => {
      const c = clamp(i);
      setStep(c);
      router.push(`${ARC_DEMO_STEPS[c].href}?demo=1&step=${c + 1}`);
    },
    [router]
  );

  const exit = useCallback(() => {
    setArcDemo(false);
    setActive(false);
    router.push(pathname);
  }, [router, pathname]);

  if (!active) return null;
  const s = ARC_DEMO_STEPS[step];

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t-2 border-[#5391D5] bg-[#010131] text-white shadow-[0_-6px_24px_rgba(1,1,49,0.35)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#5391D5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Compass className="h-3 w-3" /> Demo
            </span>
            <span className="text-xs font-semibold text-white/90">
              Step {step + 1} of {TOTAL}: {s.title}
            </span>
            <span className="ml-auto hidden gap-1 sm:flex">
              {ARC_DEMO_STEPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to step ${i + 1}`}
                  onClick={() => goToStep(i)}
                  className={`h-1.5 w-5 rounded-full transition-colors ${i === step ? "bg-[#5391D5]" : "bg-white/25 hover:bg-white/50"}`}
                />
              ))}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/75">{s.blurb}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => goToStep(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1 rounded-md border border-white/25 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <a
            href={`${s.href}?demo=1&step=${step + 1}`}
            className="inline-flex items-center gap-1 rounded-md border border-white/25 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
            title="Open this step's screen"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open screen
          </a>
          <button
            type="button"
            onClick={() => goToStep(step + 1)}
            disabled={step === TOTAL - 1}
            className="inline-flex items-center gap-1 rounded-md bg-[#5391D5] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#5391D5]/90 disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={exit}
            className="inline-flex items-center rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Exit guided demo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
