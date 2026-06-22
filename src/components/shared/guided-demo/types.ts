// Shared guided-demo system (BD pitch tool). One root-mounted component renders
// the right service's launcher + rail based on the current route, so every
// service has its own guided walkthrough without per-layout wiring or collisions.

export type GuidedDemoStep = {
  /** Short step title, e.g. "Design the engagement". */
  title: string;
  /** 1-2 plain sentences of narration (no em dashes). */
  blurb: string;
  /** A real static route this step deep-links to. */
  href: string;
};

export type GuidedDemoTrack = {
  /** Stable id, also the `?demo=<id>` activation value. */
  id: string;
  /** Human label for the launcher, e.g. "AI Readiness". */
  label: string;
  /** Brand accent hex (top border, badge, Next button, step dots). */
  accent: string;
  /**
   * Path prefixes this service owns (boundary-matched: "/ara" matches "/ara"
   * and "/ara/engage" but not "/arax"). Longest match wins when resolving the
   * launcher for the current route.
   */
  routePrefixes: string[];
  /** The ordered walkthrough. */
  steps: GuidedDemoStep[];
};
