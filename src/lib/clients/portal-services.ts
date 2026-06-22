// The 7 services a client self-service portal covers, with display metadata.
// `kind` distinguishes the two distribution models: "voucher" services the
// client issues directly (Fluent/Logica/Persona/Techno), and "seat" services
// that draw on a VIFM-prepared shell (Pre-Hire/ARC/Reflect).

export type CaliberService =
  | "arc"
  | "techno"
  | "logica"
  | "prehire"
  | "persona"
  | "fluent"
  | "reflect";

export type PortalServiceMeta = {
  id: CaliberService;
  label: string; // EN
  labelAr: string; // AR
  accent: string; // brand hex
  kind: "voucher" | "seat";
};

// Ordered: the 4 self-serve voucher services first, then the 3 VIFM-managed
// seat services. The dashboard groups by `kind`.
export const PORTAL_SERVICES: PortalServiceMeta[] = [
  { id: "fluent", label: "Fluent", labelAr: "فلوينت", accent: "#d97706", kind: "voucher" },
  { id: "logica", label: "Logica", labelAr: "لوجيكا", accent: "#c026d3", kind: "voucher" },
  { id: "persona", label: "Persona", labelAr: "بيرسونا", accent: "#0891b2", kind: "voucher" },
  { id: "techno", label: "Techno", labelAr: "تكنو", accent: "#4f46e5", kind: "voucher" },
  { id: "prehire", label: "Pre-Hire", labelAr: "ما قبل التوظيف", accent: "#e11d48", kind: "seat" },
  { id: "arc", label: "AI Readiness", labelAr: "الجاهزية للذكاء الاصطناعي", accent: "#7c3aed", kind: "seat" },
  { id: "reflect", label: "Reflect 360", labelAr: "ريفلكت 360", accent: "#0d9488", kind: "seat" },
];

export const PORTAL_SERVICE_IDS: CaliberService[] = PORTAL_SERVICES.map((s) => s.id);

export function portalService(id: string): PortalServiceMeta | undefined {
  return PORTAL_SERVICES.find((s) => s.id === id);
}
