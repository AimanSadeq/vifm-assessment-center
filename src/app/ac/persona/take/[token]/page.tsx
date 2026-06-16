import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { loadPersonaRoleOptions } from "@/lib/scoring/persona-roles";
import { PersonaStandaloneClient } from "../../_components/persona-standalone-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Persona assessment · VIFM" };

/**
 * Token-gated Persona runner for voucher delegates (no account). The redemption
 * token is validated server-side; the session is stamped with the voucher's
 * client org by startPersonaAction. Public (middleware-bypassed).
 */
export default async function PersonaTakePage({ params }: { params: { token: string } }) {
  const sb = createServiceClient();
  const { data: redemption } = await sb
    .from("persona_voucher_redemptions")
    .select("redemption_token, redeemer_name")
    .eq("redemption_token", params.token)
    .maybeSingle<{ redemption_token: string; redeemer_name: string }>();
  if (!redemption) return notFound();

  const roleProfiles = await loadPersonaRoleOptions();

  return (
    <div className="min-h-screen bg-background">
      <header className="ara-hero relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-16">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-8 max-w-2xl">
            <span className="ara-eyebrow text-accent">
              <Layers className="h-3 w-3" /> VIFM Persona
            </span>
            <h1 className="ara-numeral mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Welcome{redemption.redeemer_name ? `, ${redemption.redeemer_name}` : ""}
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-3xl px-6 pb-16">
        <PersonaStandaloneClient
          competencies={BEHAVIORAL_COMPETENCIES}
          redemptionToken={redemption.redemption_token}
          prefillName={redemption.redeemer_name ?? undefined}
          roleProfiles={roleProfiles}
        />
      </main>
    </div>
  );
}
