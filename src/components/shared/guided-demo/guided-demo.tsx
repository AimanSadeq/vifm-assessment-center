"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Compass, ChevronLeft, ChevronRight, ExternalLink, X, Play } from "lucide-react";
import { getTrackById, resolveTrackForPath, isGuidedDemoRailSuppressed } from "./tracks";
import {
  ACTIVE_LS,
  STEP_LS,
  DEMO_EVENT,
  getActiveTrackId,
  getActiveStep,
  startDemo,
  setDemoStep,
  stopDemo,
} from "./state";

/**
 * Root-mounted guided-demo control (BD pitch tool). Renders nothing for real
 * end users by default:
 *  - On a service route with no demo running -> a small "Guided demo" launcher
 *    pill for that service (off by default; presenter-only intent).
 *  - While a demo is running -> a fixed bottom rail that walks that service's
 *    steps, deep-linking into the real screens, persisting across navigation.
 *
 * Activation: the launcher pill, or `?demo=<trackId>&step=N` on any owned route.
 * State lives in localStorage so it survives navigation. Non-destructive.
 */

/**
 * Report routes must never carry the demo UI - the launcher pill would sit on
 * top of a report on screen AND leak into the printed PDF (the PDF renders the
 * same route with ?bare=1). Covers `/.../report`, `/.../reports`, hyphenated
 * report routes like `/.../cohort-report`, and the Reflect framework preview.
 */
function isReportRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/report") ||
    pathname.includes("-report") ||
    pathname.includes("/framework-preview")
  );
}

export function GuidedDemo() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Re-evaluate on every navigation: read ?demo / ?step from the URL, fall back
  // to localStorage. Reading window.location avoids useSearchParams (which would
  // force a Suspense boundary in the root layout).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const evaluate = () => {
      const params = new URLSearchParams(window.location.search);
      const demoParam = params.get("demo");
      let id = getActiveTrackId();
      if (demoParam && getTrackById(demoParam)) {
        id = demoParam;
        if (getActiveTrackId() !== demoParam) window.localStorage.setItem(ACTIVE_LS, demoParam);
      }
      setActiveId(id);
      if (!id) return;
      const track = getTrackById(id);
      const max = track ? track.steps.length - 1 : 0;
      const stepParam = params.get("step");
      let st = getActiveStep();
      if (stepParam && /^\d+$/.test(stepParam)) st = parseInt(stepParam, 10) - 1;
      st = Math.min(Math.max(st, 0), max);
      setStep(st);
      window.localStorage.setItem(STEP_LS, String(st));
    };
    evaluate();
    window.addEventListener(DEMO_EVENT, evaluate);
    return () => window.removeEventListener(DEMO_EVENT, evaluate);
  }, [pathname]);

  const activeTrack = getTrackById(activeId);

  const goToStep = useCallback(
    (i: number) => {
      if (!activeTrack) return;
      const c = Math.min(Math.max(i, 0), activeTrack.steps.length - 1);
      setStep(c);
      setDemoStep(c);
      router.push(`${activeTrack.steps[c].href}?demo=${activeTrack.id}&step=${c + 1}`);
    },
    [router, activeTrack]
  );

  const launch = useCallback(
    (trackId: string) => {
      const track = getTrackById(trackId);
      if (!track) return;
      startDemo(track.id, 0);
      setActiveId(track.id);
      setStep(0);
      router.push(`${track.steps[0].href}?demo=${track.id}&step=1`);
    },
    [router]
  );

  const exit = useCallback(() => {
    stopDemo();
    setActiveId(null);
    router.push(pathname);
  }, [router, pathname]);

  // Never overlay a report (on screen or in its printed PDF).
  if (isReportRoute(pathname)) return null;

  // Never overlay a real respondent's screen with the consultant-facing rail.
  // It persists in localStorage across navigation, which is how it leaked into
  // the trial respondents' signup (/ara/redeem) + assessment (/ara/respond)
  // screens. Suppressed on the answering + real-signup surfaces only - the free
  // /ara/personal snapshot is intentionally NOT suppressed so the guided demo
  // can still showcase it. (The idle launcher pill has its own, broader
  // exclusion via resolveTrackForPath below.)
  if (isGuidedDemoRailSuppressed(pathname)) return null;

  // ── Running demo: the full rail ──
  if (activeTrack) {
    const total = activeTrack.steps.length;
    const s = activeTrack.steps[step];
    const accent = activeTrack.accent;
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-[80] border-t-2 bg-[#010131] text-white shadow-[0_-6px_24px_rgba(1,1,49,0.35)]"
        style={{ borderTopColor: accent }}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: accent }}
              >
                <Compass className="h-3 w-3" /> {activeTrack.label}
              </span>
              <span className="text-xs font-semibold text-white/90">
                Step {step + 1} of {total}: {s.title}
              </span>
              <span className="ml-auto hidden gap-1 sm:flex">
                {activeTrack.steps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to step ${i + 1}`}
                    onClick={() => goToStep(i)}
                    className="h-1.5 w-5 rounded-full transition-colors"
                    style={{ backgroundColor: i === step ? accent : "rgba(255,255,255,0.25)" }}
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
              href={`${s.href}?demo=${activeTrack.id}&step=${step + 1}`}
              className="inline-flex items-center gap-1 rounded-md border border-white/25 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
              title="Open this step's screen"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open screen
            </a>
            <button
              type="button"
              onClick={() => goToStep(step + 1)}
              disabled={step === total - 1}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: accent }}
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

  // ── Idle on a service route: the launcher pill ──
  const launchTrack = resolveTrackForPath(pathname);
  if (!launchTrack || launchTrack.steps.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => launch(launchTrack.id)}
      title={`Start the guided ${launchTrack.label} walkthrough`}
      className="fixed bottom-4 end-4 z-[70] inline-flex items-center gap-2 rounded-full border bg-[#010131] px-3.5 py-2 text-xs font-semibold text-white shadow-lg transition-transform hover:scale-105"
      style={{ borderColor: launchTrack.accent }}
    >
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: launchTrack.accent }}
      >
        <Play className="h-3 w-3" />
      </span>
      Guided demo
    </button>
  );
}
