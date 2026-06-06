// Guided Start — combined-plan deep-link helper.
//
// The plan's "Set up →" links carry the chosen client as `?org=<id>&orgName=<name>`.
// Each create page loads its OWN client list (Pre-Hire/AC read `organizations`;
// ARA/Reflect read `ara_organizations` — different id spaces), so we resolve the
// link to an id that exists in *this* page's list: match by id first, then by
// name (case-insensitive). Returns "" when there's no match (picker stays empty).

export function resolvePlanOrgId(
  orgs: { id: string; name: string | null }[],
  params?: { org?: string; orgName?: string },
): string {
  if (!params) return "";
  if (params.org && orgs.some((o) => o.id === params.org)) return params.org;
  const want = params.orgName?.trim().toLowerCase();
  if (want) {
    const byName = orgs.find((o) => (o.name ?? "").trim().toLowerCase() === want);
    if (byName) return byName.id;
  }
  return "";
}
