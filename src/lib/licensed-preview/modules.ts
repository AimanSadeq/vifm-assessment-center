import {
  LayoutDashboard,
  Target,
  Wrench,
  Brain,
  UserCircle,
  Languages,
  Sparkles,
  Aperture,
  UserPlus,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

// The module registry for the Licensed Portal Preview, grouped to tell the
// Caliber platform story: Command -> Diagnose -> Acquire -> Develop -> Certify ->
// Succeed. Each module renders a branded, sample-data dashboard inside the tenant.

export type ModuleGroupKey = "command" | "diagnose" | "acquire" | "develop" | "certify" | "succeed";

export type PreviewModule = {
  id: string;
  label: string;
  tagline: string;
  icon: LucideIcon;
  tone: string; // hex
  group: ModuleGroupKey;
  metricLabel: string; // what the avg score represents on this module
};

export const MODULE_GROUPS: { key: ModuleGroupKey; label: string; caption: string }[] = [
  { key: "command", label: "Command", caption: "Your HQ" },
  { key: "diagnose", label: "Diagnose", caption: "Measure capability" },
  { key: "acquire", label: "Acquire", caption: "Hire on evidence" },
  { key: "develop", label: "Develop", caption: "Close the gaps" },
  { key: "certify", label: "Certify", caption: "Prove it" },
  { key: "succeed", label: "Succeed", caption: "Build the bench" },
];

export const PREVIEW_MODULES: PreviewModule[] = [
  { id: "command", label: "Command Center", tagline: "Workforce intelligence at a glance", icon: LayoutDashboard, tone: "#5391D5", group: "command", metricLabel: "Workforce readiness" },

  { id: "ac", label: "Assessment Center", tagline: "Behavioural competence, observed", icon: Target, tone: "#5391D5", group: "diagnose", metricLabel: "Avg competency" },
  { id: "techno", label: "Techno® Technical", tagline: "Job-ready technical proficiency", icon: Wrench, tone: "#6366f1", group: "diagnose", metricLabel: "Avg proficiency" },
  { id: "logica", label: "Logica® Cognitive", tagline: "Reasoning aptitude under time", icon: Brain, tone: "#0891b2", group: "diagnose", metricLabel: "Avg aptitude" },
  { id: "persona", label: "Persona® Behavioural", tagline: "Self-reported working style", icon: UserCircle, tone: "#8b5cf6", group: "diagnose", metricLabel: "Avg index" },
  { id: "fluent", label: "Fluent® English", tagline: "CEFR-aligned language placement", icon: Languages, tone: "#0ea5e9", group: "diagnose", metricLabel: "Avg CEFR score" },
  { id: "arc", label: "AR Compass® AI Readiness", tagline: "Readiness to use & govern AI", icon: Sparkles, tone: "#7c3aed", group: "diagnose", metricLabel: "Avg readiness" },
  { id: "reflect", label: "Reflect 360°", tagline: "Multi-rater leadership feedback", icon: Aperture, tone: "#db2777", group: "diagnose", metricLabel: "Avg leadership" },

  { id: "prehire", label: "Pre-Hire® Screening", tagline: "Evidence-based shortlisting", icon: UserPlus, tone: "#e11d48", group: "acquire", metricLabel: "Avg composite" },

  { id: "academy", label: "VIFM Academy", tagline: "Targeted learning that closes gaps", icon: GraduationCap, tone: "#16a34a", group: "develop", metricLabel: "Avg completion" },
];

export const DIAGNOSE_MODULES = PREVIEW_MODULES.filter((m) => m.group === "diagnose");
export const moduleById = (id: string): PreviewModule | undefined => PREVIEW_MODULES.find((m) => m.id === id);
