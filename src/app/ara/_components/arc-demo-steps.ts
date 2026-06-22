// ARC guided-demo roadmap (BD trial). Each step narrates one stage of the AI
// Readiness Compass story and deep-links to the real /ara screen, so a presenter
// can walk a client through the actual product (on demo data) and follow along.
// Non-destructive: the rail only navigates + narrates; nothing is submitted for
// the client unless the presenter chooses to.

export type ArcDemoStep = {
  title: string;
  blurb: string;
  href: string;
};

export const ARC_DEMO_STEPS: ArcDemoStep[] = [
  {
    title: "What ARC measures",
    blurb:
      "ARC scores organisational AI readiness across eight pillars - Strategy, Data, Technology, Talent, Culture, Governance, Operations, Model Management - with a perception-vs-reality check. Bilingual (EN/AR) throughout.",
    href: "/ara",
  },
  {
    title: "How engagements work",
    blurb:
      "A four-tier model: from a complimentary Personal Snapshot and a sample Department diagnostic up to a board-grade Enterprise engagement - so a client starts small and scales. The first two tiers are free.",
    href: "/ara/engage",
  },
  {
    title: "Set up an organisation assessment",
    blurb:
      "The consultant configures an engagement in a short wizard: organisation, stage (department / division / enterprise), pillars in scope, pillar weights, and who responds - plus optional individual and agentic-AI layers.",
    href: "/ara/consultant/assessments/new",
  },
  {
    title: "Experience it live - free Personal Snapshot",
    blurb:
      "Let the client take the free Personal AI Readiness Snapshot now - around 24 questions, a few minutes, anonymous - and see their own four-factor result. The fastest 'aha' moment in the pitch.",
    href: "/ara/personal/start",
  },
  {
    title: "Results, cohort & the board-ready report",
    blurb:
      "Back in the consultant view: pillar maturity, perception-vs-reality, shadow-AI alerts, the gap heatmap, the Phase-2 capability-building plan, and the bilingual board-ready PDF you hand to the client's leadership.",
    href: "/ara/consultant",
  },
];
