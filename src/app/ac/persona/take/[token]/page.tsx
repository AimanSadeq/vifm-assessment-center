import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { loadPersonaCompetencies } from "@/lib/persona/bank";
import { loadPersonaRoleOptions } from "@/lib/scoring/persona-roles";
import { loadCompetencyDefinitions } from "@/lib/scoring/competency-definitions";
import { getVoucherScopeByRedemptionToken } from "@/lib/persona/vouchers";
import { PersonaStandaloneClient } from "../../_components/persona-standalone-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Persona® assessment · VIFM" };

/**
 * Token-gated Persona runner for voucher delegates (no account). The redemption
 * token is validated server-side; the session is stamped with the voucher's
 * client org by startPersonaAction. Public (middleware-bypassed).
 */
export default async function PersonaTakePage({
  params,
}: {
  params: { token: string };
}) {
  const sb = createServiceClient();
  const { data: redemption } = await sb
    .from("persona_voucher_redemptions")
    .select("id, redemption_token, redeemer_name, voucher_id")
    .eq("redemption_token", params.token)
    .maybeSingle<{ id: string; redemption_token: string; redeemer_name: string; voucher_id: string }>();
  if (!redemption) return notFound();

  // Re-check the voucher at take time (not just at redeem): a code disabled or
  // expired AFTER redemption must not keep serving the assessment. Also drives
  // the welcome-header direction from the voucher language. Tolerant: on a read
  // error or pending migration, default to active + EN rather than lock people out.
  let headerAr = false;
  let voucherDead = false;
  try {
    const { data: v } = await sb
      .from("persona_vouchers")
      .select("default_language, status, expires_at")
      .eq("id", redemption.voucher_id)
      .maybeSingle<{ default_language: string; status: string | null; expires_at: string | null }>();
    headerAr = v?.default_language === "ar";
    const expired = !!v?.expires_at && new Date(v.expires_at).getTime() < Date.now();
    voucherDead = v?.status === "disabled" || expired;
  } catch {
    /* default en + active */
  }

  // Block a dead voucher unless the delegate already completed their sitting
  // (then the report stands and the message would be confusing).
  if (voucherDead) {
    const { data: prior } = await sb
      .from("behavioral_assessment_sessions")
      .select("id")
      .eq("voucher_redemption_id", redemption.id)
      .eq("status", "submitted")
      .maybeSingle<{ id: string }>();
    if (!prior) {
      return (
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
          <VifmLogo variant="color" size="md" />
          <h1 className="mt-6 text-xl font-semibold text-[#010131]">This assessment link is no longer active</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The voucher for this Persona® assessment has expired or been withdrawn. Please contact the organisation
            that invited you for a new link.
          </p>
        </div>
      );
    }
  }

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
  const allCompetencies = await loadPersonaCompetencies();
  const competencies = scopedSet
    ? allCompetencies.filter((c) => scopedSet.has(c.acCompetencyId))
    : allCompetencies;
  // Guard against an over-narrow / stale scope leaving nothing to serve.
  const servedCompetencies = competencies.length > 0 ? competencies : allCompetencies;
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
      <header className="ara-hero relative overflow-hidden" dir={headerAr ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-16">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-8 max-w-2xl">
            <span className="ara-eyebrow text-accent">
              <Layers className="h-3 w-3" /> VIFM Persona®
            </span>
            <h1 className="ara-numeral mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {headerAr ? "مرحبًا" : "Welcome"}{redemption.redeemer_name ? `${headerAr ? "، " : ", "}${redemption.redeemer_name}` : ""}
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
          // The "fill random answers" demo shortcut must never be reachable by a
          // real delegate on the public token route - gate it to non-production
          // only, ignoring any ?demo=1 query a candidate could append.
          demo={process.env.NODE_ENV !== "production"}
        />
      </main>
    </div>
  );
}
