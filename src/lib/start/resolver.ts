// Guided Start — the requirement resolver (the "brain").
//
// resolveProcess(answers) maps the user's plain-language selections to the
// diagnosed requirement + the process that meets it. Pure + deterministic. The
// registry below is the single source of truth; new modules register here.

import type { StartGoal, WizardAnswers, ProcessPlan } from "./types";

// ── Step 1: goals (outcome language, never module names) ─────────
// Clustered into the two talent-lifecycle solution families (mirrors the
// landing + sidebar): acquisition = assessing who you bring in; management =
// growing who you have.
export const GOALS: { id: StartGoal; icon: string; pillar: "acquire" | "manage" }[] = [
  // Talent Acquisition
  { id: "hire", icon: "UserCheck", pillar: "acquire" },
  { id: "certify", icon: "BadgeCheck", pillar: "acquire" },
  // Talent Management
  { id: "develop", icon: "Sprout", pillar: "manage" },
  { id: "succession", icon: "TrendingUp", pillar: "manage" },
  { id: "ai_readiness", icon: "BrainCircuit", pillar: "manage" },
  { id: "feedback_360", icon: "Users", pillar: "manage" },
];

// ── Step 2: per-goal context choice (adaptive) ───────────────────
export const CONTEXT_OPTIONS: Record<StartGoal, { id: string }[]> = {
  hire: [{ id: "screen_many" }, { id: "deep_select" }],
  develop: [{ id: "individual" }, { id: "leadership_360" }, { id: "cohort" }],
  succession: [{ id: "cohort_role" }],
  certify: [{ id: "technical" }, { id: "english" }, { id: "ability" }],
  ai_readiness: [{ id: "organization" }, { id: "individual" }],
  feedback_360: [{ id: "leader" }],
};

// ── Process registry ─────────────────────────────────────────────
export const PROCESS: Record<string, ProcessPlan> = {
  prehire: {
    key: "prehire",
    requirementKey: "pre_screen",
    module: "prehire",
    constructs: ["knowledge", "language", "behaviour"],
    instruments: ["quiz", "fluent", "cbi"],
    launch: "inline",
    createRoute: "/admin/prehire/new",
    rationaleKey: "prehire",
  },
  ac_selection: {
    key: "ac_selection",
    requirementKey: "selection_ac",
    module: "ac",
    constructs: ["behaviour"],
    instruments: ["ac_exercises", "cbi"],
    launch: "inline",
    createRoute: "/admin/engagements/new",
    rationaleKey: "ac_selection",
  },
  ac_development: {
    key: "ac_development",
    requirementKey: "dev_centre",
    module: "ac",
    constructs: ["behaviour"],
    instruments: ["ac_exercises"],
    launch: "inline",
    createRoute: "/admin/engagements/new",
    rationaleKey: "ac_development",
  },
  ac_succession: {
    key: "ac_succession",
    requirementKey: "talent_review",
    module: "ac",
    constructs: ["behaviour", "potential"],
    instruments: ["ac_exercises", "talent_map"],
    launch: "inline",
    createRoute: "/admin/engagements/new",
    rationaleKey: "ac_succession",
  },
  reflect: {
    key: "reflect",
    requirementKey: "leadership_360",
    module: "reflect",
    constructs: ["behaviour"],
    instruments: ["reflect_360"],
    launch: "inline",
    createRoute: "/reflect/consultant/engagements/new",
    rationaleKey: "reflect",
  },
  fluent: {
    key: "fluent",
    requirementKey: "language_placement",
    module: "fluent",
    constructs: ["language"],
    instruments: ["fluent"],
    launch: "handoff",
    createRoute: "/ac/fluent",
    rationaleKey: "fluent",
  },
  technical: {
    key: "technical",
    requirementKey: "technical_cert",
    module: "technical",
    constructs: ["knowledge"],
    instruments: ["technical"],
    launch: "handoff",
    createRoute: "/admin/tech-sandbox",
    rationaleKey: "technical",
  },
  ara_org: {
    key: "ara_org",
    requirementKey: "org_ai",
    module: "ara_org",
    constructs: ["org_readiness"],
    instruments: ["ara_org"],
    launch: "inline",
    createRoute: "/ara/consultant/assessments/new",
    rationaleKey: "ara_org",
  },
  ara_personal: {
    key: "ara_personal",
    requirementKey: "personal_ai",
    module: "ara_personal",
    constructs: ["disposition"],
    instruments: ["ara_personal"],
    launch: "handoff",
    createRoute: "/ara/consultant/personal-deep-dive/new",
    rationaleKey: "ara_personal",
  },
  psychometric: {
    key: "psychometric",
    requirementKey: "psychometric",
    module: "psychometric",
    constructs: ["ability", "disposition"],
    instruments: ["cognitive", "persona"],
    launch: "handoff",
    createRoute: "/ac/psychometrics",
    rationaleKey: "psychometric",
  },
};

/** Map the selections to the diagnosed process. Null until a goal is chosen. */
export function resolveProcess(a: WizardAnswers): ProcessPlan | null {
  if (!a.goal) return null;
  switch (a.goal) {
    case "hire":
      return a.context === "deep_select" ? PROCESS.ac_selection : PROCESS.prehire;
    case "develop":
      if (a.context === "leadership_360") return PROCESS.reflect;
      return PROCESS.ac_development;
    case "succession":
      return PROCESS.ac_succession;
    case "certify":
      if (a.context === "english") return PROCESS.fluent;
      if (a.context === "ability") return PROCESS.psychometric;
      return PROCESS.technical;
    case "ai_readiness":
      return a.context === "individual" ? PROCESS.ara_personal : PROCESS.ara_org;
    case "feedback_360":
      return PROCESS.reflect;
  }
}
