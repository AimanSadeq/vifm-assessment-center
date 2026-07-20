import type { GuidedDemoTrack } from "./types";

// One track per service. The root-mounted <GuidedDemo /> resolves the track for
// the current route (longest prefix match) to offer that service's launcher, and
// runs the active track's rail across its screens. Routes here are all real,
// static pages (no dynamic [param] segments) so a step never deep-links to a 404.

export const GUIDED_DEMO_TRACKS: GuidedDemoTrack[] = [
  // ─────────────────────────── Talent Acquisition ───────────────────────────
  {
    id: "ac",
    label: "Assessment Center",
    accent: "#5391D5",
    routePrefixes: [
      "/admin/assessment-center",
      "/admin/engagements",
      "/admin/exercises",
      "/admin/role-profiles",
      "/admin/assessors",
      "/admin/analytics",
    ],
    steps: [
      {
        title: "Start at the process map",
        blurb:
          "The process map shows all seven assessment stages, from project creation through report release - the end-to-end context for running an engagement.",
        href: "/admin/assessment-center",
      },
      {
        title: "Create an engagement",
        blurb:
          "A five-step wizard sets up an assessment-center project: pick the client, define the target competencies (with a JD-to-competency extractor), and assign exercises.",
        href: "/admin/engagements/new",
      },
      {
        title: "Configure exercises",
        blurb:
          "The exercise library carries timing, briefing and role-player content. Each exercise maps to specific competencies so every behaviour is observed consistently.",
        href: "/admin/exercises",
      },
      {
        title: "Reusable role profiles",
        blurb:
          "Role profiles are reusable competency packs with priority weighting, so a new engagement can adopt a proven assessment design in seconds.",
        href: "/admin/role-profiles",
      },
      {
        title: "The assessor pool",
        blurb:
          "See lead and associate assessors with their assignments and rating volume - track consistency and balance workload for fair, reliable scoring.",
        href: "/admin/assessors",
      },
      {
        title: "Analytics and reliability",
        blurb:
          "Inter-rater reliability (ICC), bias detection by assessor, competency strengths and gaps, and per-candidate OAR scores validate the rigour of the assessment.",
        href: "/admin/analytics",
      },
    ],
  },
  {
    id: "prehire",
    label: "Pre-Hire",
    accent: "#e11d48",
    routePrefixes: ["/admin/prehire"],
    steps: [
      {
        title: "The requisition list",
        blurb:
          "Every screening requisition with candidate counts and status at a glance - the hub for the whole pre-employment screening pipeline.",
        href: "/admin/prehire",
      },
      {
        title: "Create a screening",
        blurb:
          "One form sets up a requisition: client, job title, role profile, and the ordered stage plan (quiz, Fluent English, AI interview) with weights and cut-scores.",
        href: "/admin/prehire/new",
      },
      {
        title: "Invite and rank candidates",
        blurb:
          "Open a requisition to invite candidates, watch each stage complete, and read the ranked shortlist - composite score, per-stage results, and an advisory signal (Advance / Review / Hold). The score is a signal; a person always decides.",
        href: "/admin/prehire",
      },
      {
        title: "Retention and compliance",
        blurb:
          "Purge applicant data past the retention window while keeping requisition shells for the record - part of the module's defensibility and audit posture.",
        href: "/admin/prehire/retention",
      },
    ],
  },
  {
    id: "fluent",
    label: "Fluent",
    accent: "#d97706",
    routePrefixes: ["/ac/fluent", "/admin/fluent"],
    steps: [
      {
        title: "The placement test",
        blurb:
          "A self-served, four-skill CEFR-aligned English placement (reading, listening, writing, speaking) with an indicative level and feedback in minutes.",
        href: "/ac/fluent",
      },
      {
        title: "Redeem a voucher",
        blurb:
          "Candidates enter a code from their organisation, binding the result to the sponsoring client - no account needed.",
        href: "/ac/fluent/redeem",
      },
      {
        title: "Cohort results",
        blurb:
          "Aggregated placement results across takers, filtered by organisation, with confidence bands and integrity signals per candidate.",
        href: "/ac/fluent/cohort",
      },
      {
        title: "Score calibration",
        blurb:
          "AI-scored writing and speaking are validated against human ratings using Quadratic Weighted Kappa, targeting agreement above 0.70.",
        href: "/ac/fluent/calibration",
      },
      {
        title: "Manage vouchers",
        blurb:
          "Generate redeemable codes, assign them to clients, and track seat usage and expiry for bulk English-placement campaigns.",
        href: "/ac/fluent/vouchers",
      },
      {
        title: "Partner training courses",
        blurb:
          "Curate recommended partner English programmes that appear on placement reports based on each candidate's CEFR level.",
        href: "/admin/fluent/partner-courses",
      },
    ],
  },
  {
    id: "technical",
    label: "Techno",
    accent: "#4f46e5",
    routePrefixes: ["/admin/tech-sandbox", "/admin/tech-assessment", "/ac/tech-assessment"],
    steps: [
      {
        title: "Certification pipeline",
        blurb:
          "The command hub shows the certification pipeline - item bank, SME review, cut-scores and credentials - with per-domain readiness and throughput.",
        href: "/admin/tech-assessment",
      },
      {
        title: "Review and approve items",
        blurb:
          "SMEs examine the item bank, approve questions per technical domain, and set cut-scores. Only approved items can feed a certified assessment.",
        href: "/admin/tech-assessment/items",
      },
      {
        title: "Certification programmes",
        blurb:
          "Create standalone certification programmes tied to technical functions, issue participant tokens, and track enrolment toward a credential.",
        href: "/admin/tech-assessment/programs",
      },
      {
        title: "Build an assessment",
        blurb:
          "Assemble a custom assessment by selecting functions, skills and tasks, then issue a direct link or voucher codes for immediate candidate access.",
        href: "/admin/tech-sandbox",
      },
      {
        title: "Review results",
        blurb:
          "Scored sittings with per-competency bands and development reports - candidates get bilingual results with proficiency levels and recommended training.",
        href: "/admin/tech-sandbox/results",
      },
      {
        title: "Take a live assessment",
        blurb:
          "A hands-on assessment with live spreadsheet, calculation and SQL sandboxes, scored against master answers and mapped to the competency framework.",
        href: "/ac/tech-assessment",
      },
    ],
  },
  {
    id: "cognitive",
    label: "Logica",
    accent: "#c026d3",
    routePrefixes: ["/ac/cognitive", "/admin/psychometrics"],
    steps: [
      {
        title: "Configure the item bank",
        blurb:
          "Manage cognitive-ability items and calibration: approve items per scale, track internal-consistency reliability, and load norm groups to move from indicative to norm-referenced.",
        href: "/admin/psychometrics",
      },
      {
        title: "Take the assessment",
        blurb:
          "The Logica reasoning test runs numerical, verbal, inductive and deductive subtests as multiple-choice items, with the answer key held server-side.",
        href: "/ac/cognitive",
      },
      {
        title: "Cohort data",
        blurb:
          "Aggregated reasoning results across takers - overall g percentiles, band distributions, and per-subtest performance, filterable by client.",
        href: "/ac/cognitive/cohort",
      },
      {
        title: "Distribute vouchers",
        blurb:
          "Create and manage redeemable Logica access codes tagged to clients, tracking seat usage and expiry without requiring accounts.",
        href: "/ac/cognitive/vouchers",
      },
    ],
  },
  {
    id: "persona",
    label: "Persona",
    accent: "#0891b2",
    routePrefixes: ["/ac/persona"],
    steps: [
      {
        title: "Persona self-assessment",
        blurb:
          "The entry point to the behavioural competency self-assessment, with quick-start options for standalone assessments, vouchers, results and cohort analytics.",
        href: "/ac/persona",
      },
      {
        title: "Redeem a voucher",
        blurb:
          "Candidates enter a Persona code issued by an admin - no account required; they provide name, email and company before starting.",
        href: "/ac/persona/redeem",
      },
      {
        title: "Individual results",
        blurb:
          "An admin console of completed assessments with fit scores, self-ratings, target-role alignment and downloadable PDF reports, filterable by client.",
        href: "/ac/persona/results",
      },
      {
        title: "Cohort patterns",
        blurb:
          "Aggregated self-report dashboard: cohort self-rating distribution, average scores by band, and a per-candidate breakdown across clients.",
        href: "/ac/persona/cohort",
      },
      {
        title: "Vouchers and roles",
        blurb:
          "Generate redeemable vouchers, scope assessments to a competency set or role, and design the target-role profiles that feed hiring and development.",
        href: "/ac/persona/vouchers",
      },
    ],
  },
  // ─────────────────────────── Talent Development ───────────────────────────
  {
    id: "ara",
    label: "AI Readiness (AR Compass)",
    accent: "#7c3aed",
    routePrefixes: ["/ara"],
    steps: [
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
        title: "Set up an assessment",
        blurb:
          "The consultant configures an engagement in a short wizard: organisation, stage (department / division / enterprise), pillars in scope, pillar weights, and who responds - plus optional individual and agentic-AI layers.",
        href: "/ara/consultant/assessments/new",
      },
      {
        title: "Experience it live - Personal Snapshot",
        blurb:
          "Let the client take the free Personal AI Readiness Snapshot now - around 24 questions, a few minutes, anonymous - and see their own four-factor result. The fastest 'aha' moment in the pitch.",
        href: "/ara/personal/start",
      },
      {
        title: "Results and the board-ready report",
        blurb:
          "Back in the consultant view: pillar maturity, perception-vs-reality, shadow-AI alerts, the gap heatmap, the Phase-2 capability-building plan, and the bilingual board-ready PDF.",
        href: "/ara/consultant",
      },
    ],
  },
  {
    id: "reflect",
    label: "Reflect 360",
    accent: "#0d9488",
    routePrefixes: ["/reflect"],
    steps: [
      {
        title: "Reflect 360 overview",
        blurb:
          "The bilingual 360-degree leadership-feedback module - the entry point to the consultant dashboard and the admin console.",
        href: "/reflect",
      },
      {
        title: "Consultant dashboard",
        blurb:
          "Every active and archived engagement in one place, with one click into the 5-step wizard to create a new feedback engagement.",
        href: "/reflect/consultant",
      },
      {
        title: "Create an engagement",
        blurb:
          "A 5-step wizard sets organisation, competency framework, rater levels, participants and launch settings. AI turns the client's corporate values into observable behaviours.",
        href: "/reflect/consultant/engagements/new",
      },
      {
        title: "Framework templates",
        blurb:
          "Curated library templates (e.g. VIFM Leadership Essentials) that consultants can clone or use as a starting point for a custom framework.",
        href: "/reflect/admin/templates",
      },
      {
        title: "Admin console",
        blurb:
          "VIFM staff monitor active engagements, manage the template library, track email delivery, and run retention cleanup for archived feedback.",
        href: "/reflect/admin",
      },
    ],
  },
  {
    id: "readiness",
    label: "Succession Readiness",
    accent: "#f59e0b",
    routePrefixes: ["/admin/readiness"],
    steps: [
      {
        title: "Understand the service",
        blurb:
          "Succession Readiness fuses self-assessment (Persona) and 360 feedback (Reflect) against a target role to produce a readiness verdict. The home page orients you to the inputs and the three-step process.",
        href: "/admin/readiness",
      },
      {
        title: "Start a programme",
        blurb:
          "Create a readiness engagement by picking a client, naming the programme and (optionally) a target role - ready to enrol candidates.",
        href: "/admin/readiness",
      },
      {
        title: "Tune the scoring engine",
        blurb:
          "Configure global readiness thresholds - tier cutoffs, weighting, knockout guardrails and confidence bands - applied to every verdict without a code deploy.",
        href: "/admin/readiness/config",
      },
    ],
  },
  {
    id: "academy",
    label: "VIFM Academy",
    accent: "#059669",
    routePrefixes: ["/courses", "/admin/courses"],
    steps: [
      {
        title: "Browse the catalogue",
        blurb:
          "The public, industry-specific course library, filtered by domain and level - each programme shows duration, languages and certification.",
        href: "/courses",
      },
      {
        title: "Request a quote",
        blurb:
          "An organisation submits a quote request with group size and preferred start date; the lead flows to the VIFM sales queue for follow-up.",
        href: "/courses",
      },
      {
        title: "Manage the catalogue",
        blurb:
          "VIFM staff review every active course, apply filters, and manage the catalogue - with options to import new content or flag duplicates.",
        href: "/admin/courses",
      },
      {
        title: "Import courses with AI",
        blurb:
          "Upload course PDFs and Claude extracts the seven content blocks - overview, objectives, competencies, audience, methodology, outline and notes.",
        href: "/admin/courses/import",
      },
      {
        title: "Process quote requests",
        blurb:
          "Triage incoming requests by status (new / contacted / quoted / won / lost), track client context, and send a proposal.",
        href: "/admin/courses/quotes",
      },
    ],
  },
];

// Routes that must NEVER surface the guided-demo UI - neither the idle launcher
// pill NOR the running rail. These are anonymous / token end-user flows (someone
// actually signing up for or sitting an assessment) and auth pages. A trial
// respondent reported the consultant-facing rail (with BD "what to do next"
// steps) overlaying the signup page AND the live assessment, because the rail
// persists in localStorage across navigation. An end user must never see it, so
// the rail is suppressed on these surfaces (a presenter demoing simply won't see
// the coaching overlay on the end-user screens - an acceptable trade for not
// leaking BD copy to real respondents).
const EXCLUDED_PREFIXES = [
  "/ara/respond",
  "/ara/personal",
  "/ara/redeem",
  "/reflect/respond",
  "/prehire/apply",
  "/ac/persona/take",
  "/ac/cognitive/take",
  "/ac/fluent/take",
  "/ac/fluent/redeem",
  "/candidate",
  "/verify",
  "/login",
  "/register",
  "/update-password",
  "/reset-password",
];

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

/**
 * True when the path must not surface the idle LAUNCHER pill (the full end-user
 * exclusion, incl. the free /ara/personal snapshot - a public user should never
 * be offered a "Guided demo" pill).
 */
export function isGuidedDemoExcluded(path: string | null | undefined): boolean {
  if (!path) return false;
  return EXCLUDED_PREFIXES.some((p) => matchesPrefix(path, p));
}

// Surfaces where even a RUNNING rail must never appear: a real end-user is
// actively answering, or signing up for a real (invited) assessment. This is
// NARROWER than the launcher exclusion - it deliberately omits /ara/personal so
// the guided demo can still walk a presenter through the free Personal Snapshot
// (its own step deep-links there), while a real respondent on /ara/respond or a
// real signup on /ara/redeem never sees the consultant-facing rail.
const RAIL_SUPPRESSED_PREFIXES = [
  "/ara/respond",
  "/ara/redeem",
  "/reflect/respond",
  "/prehire/apply",
  "/ac/persona/take",
  "/ac/cognitive/take",
  "/ac/fluent/take",
  "/ac/fluent/redeem",
  "/candidate",
  "/verify",
  "/login",
  "/register",
  "/update-password",
  "/reset-password",
];

/**
 * True when the RUNNING guided-demo rail must be suppressed (an end-user is
 * answering or in a real signup flow). Used by GuidedDemo before it renders the
 * rail so consultant/BD step copy never overlays a real respondent's screen.
 */
export function isGuidedDemoRailSuppressed(path: string | null | undefined): boolean {
  if (!path) return false;
  return RAIL_SUPPRESSED_PREFIXES.some((p) => matchesPrefix(path, p));
}

export function getTrackById(id: string | null | undefined): GuidedDemoTrack | undefined {
  if (!id) return undefined;
  return GUIDED_DEMO_TRACKS.find((t) => t.id === id);
}

/** The service track that owns the current route, or null (no launcher here). */
export function resolveTrackForPath(path: string): GuidedDemoTrack | null {
  if (EXCLUDED_PREFIXES.some((p) => matchesPrefix(path, p))) return null;
  let best: GuidedDemoTrack | null = null;
  let bestLen = -1;
  for (const track of GUIDED_DEMO_TRACKS) {
    for (const prefix of track.routePrefixes) {
      if (matchesPrefix(path, prefix) && prefix.length > bestLen) {
        best = track;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}
