import { Layers } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { loadVoucherBlock } from "@/lib/vouchers/status";
import { PersonaRedeemPageClient } from "./_components/redeem-page-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem a code · VIFM Persona®" };

// Only the voucher CODE is honoured from the URL (voucher links carry it).
// Name/email/company are NOT pre-filled from query params - pre-filling PII from a
// crafted link is a phishing vector; the redeemer types their own details.
type Props = { searchParams?: { code?: string } };

export default async function PersonaRedeemPage({ searchParams }: Props) {
  const initialCode = searchParams?.code?.trim() ?? "";
  // Surface a spent/expired/deactivated code before the delegate fills the
  // form in, rather than after they submit it (shared with every service).
  const blocked = await loadVoucherBlock("persona", initialCode);
  // The blocked card is already bilingual; the working flow delegates to a
  // client shell so the hero + card follow the form's EN/AR toggle (Omar).
  if (blocked) {
    return (
      <div className="min-h-screen bg-background">
        <header className="ara-hero relative overflow-hidden">
          <div className="mx-auto max-w-3xl px-6 pt-7 pb-20">
            <VifmLogo variant="white" size="sm" />
            <div className="mt-10 max-w-2xl">
              <span className="ara-eyebrow text-accent">
                <Layers className="h-3 w-3" /> VIFM Persona®
              </span>
              <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Redeem your access code
              </h1>
            </div>
          </div>
        </header>
        <main className="relative z-10 mx-auto -mt-10 max-w-2xl px-6 pb-16">
          <VoucherBlockedCard block={blocked} code={initialCode} redeemPath="/ac/persona/redeem" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PersonaRedeemPageClient initialCode={initialCode} />
    </div>
  );
}
