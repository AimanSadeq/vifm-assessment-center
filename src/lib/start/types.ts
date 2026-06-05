// Guided Start — types for the requirement resolver. Pure + UI-agnostic so the
// decision logic is unit-testable and shared. The wizard is ADDITIVE: it never
// replaces a module's own create flow — it either creates inline (reusing that
// module's server action) or hands off to the module's existing create route.

export type StartGoal =
  | "hire"
  | "develop"
  | "succession"
  | "certify"
  | "ai_readiness"
  | "feedback_360";

export type StartDepth = "quick" | "standard" | "certified";

/** The answers gathered across the wizard steps. `context` is the Step-2 choice id. */
export type WizardAnswers = {
  goal: StartGoal | null;
  context: string | null;
  depth: StartDepth | null;
};

export type ProcessModule =
  | "prehire"
  | "ac"
  | "ara_org"
  | "ara_personal"
  | "reflect"
  | "fluent"
  | "technical"
  | "psychometric";

export type ProcessPlan = {
  key: string;
  /** The diagnosed requirement — i18n key under start.requirement.* */
  requirementKey: string;
  module: ProcessModule;
  /** Layered-model constructs measured — i18n keys under start.construct.* */
  constructs: string[];
  /** Instruments used — i18n keys under start.instrument.* */
  instruments: string[];
  /** "inline" = the wizard creates it in place (reusing the module's action);
   *  "handoff" = open the module's own (untouched) create flow. */
  launch: "inline" | "handoff";
  /** Where a handoff (and the "set it up myself" path) goes. */
  createRoute: string;
  /** One-line rationale — i18n key under start.rationale.* */
  rationaleKey: string;
  /** true when the target module isn't built yet (psychometrics). */
  proposed?: boolean;
};
