import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { loadPersonaRoleOptions } from "@/lib/scoring/persona-roles";
import { loadCompetencyDefinitions } from "@/lib/scoring/competency-definitions";
import { getVoucherScopeByRedemptionToken } from "@/lib/persona/vouchers";
import { PersonaStandaloneClient } from "../../_components/persona-standalone-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Persona assessment · VIFM" };

/**
 * Token-gated Persona runner for voucher delegates (no account). The redemption
 * token is validated server-side; the session is stamped with the voucher's
 * client org by startPersonaAction. Public (middleware-bypassed).
 */
export default async function PersonaTakePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { demo?: string };
}) {
  const sb = createServiceClient();
  const { data: redemption } = await sb
    .from("persona_voucher_redemptions")
    .select("redemption_token, redeemer_name")
    .eq("redemption_token", params.token)
    .maybeSingle<{ redemption_token: string; redeemer_name: string }>();
  if (!redemption) return notFound();

  const [roleProfiles, definitions] = await Promise.all([
    loadPersonaRoleOptions(),
    loadCompetencyDefinitions(),
  ]);

  // Admin-pinned scope (00123): when the voucher pins purpose/role/competencies,
  // the candidate just takes the pre-configured test - the runner locks the
  // picker and we serve only the scoped competencies' items.
  const scope = await getVoucherScopeByRedemptionToken(redemption.redemption_token);
  const scopedSet = scope.scopedCompetencyIds && scope.scopedCompetencyIds.length > 0
    ? new Set(scope.scopedCompetencyIds)
    : null;
  const competencies = scopedSet
    ? BEHAVIORAL_COMPETENCIES.filter((c) => scopedSet.has(c.acCompetencyId))
    : BEHAVIORAL_COMPETENCIES;
  // Guard against an over-narrow / stale scope leaving nothing to serve.
  const servedCompetencies = competencies.length > 0 ? competencies : BEHAVIORAL_COMPETENCIES;
  const pinned = scope.purpose
    ? {
        purpose: scope.purpose,
        roleProfileId: scope.targetRoleProfileId,
        roleName:
          roleProfiles.find((r) => r.id === scope.targetRoleProfileId)?.name ?? null,
        // SD-9: pin the item format too so the runner serves exactly the
        // admin-chosen section(s) and the picker stays hidden.
        itemFormat: scope.itemFormat ?? undefined,
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="ara-hero relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-16">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-8 max-w-2xl">
            <span className="ara-eyebrow text-accent">
              <Layers className="h-3 w-3" /> VIFM Persona®
            </span>
            <h1 className="ara-numeral mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Welcome{redemption.redeemer_name ? `, ${redemption.redeemer_name}` : ""}
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-3xl px-6 pb-16">
        <PersonaStandaloneClient
          competencies={servedCompetencies}
          redemptionToken={redemption.redemption_token}
          prefillName={redemption.redeemer_name ?? undefined}
          roleProfiles={roleProfiles}
          pinned={pinned}
          definitions={definitions}
          demo={searchParams?.demo === "1" || process.env.NODE_ENV !== "production"}
        />
      </main>
    </div>
  );
}
