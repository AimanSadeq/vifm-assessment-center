import { UserSearch } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { loadVoucherBlock } from "@/lib/vouchers/status";
import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem your screening code · VIFM Pre-Hire®" };

type Props = {
  // Only the voucher CODE is honoured from the URL. name and email are NOT
  // pre-filled - a crafted link pre-filling someone else's PII is a phishing
  // vector (same fix applied to the ARC and Persona redeem pages).
  searchParams?: { code?: string; company?: string };
};

/**
 * Public, no-account Pre-Hire voucher redemption. The applicant enters the code
 * their employer/recruiter gave them; the redeem action provisions a candidate
 * on the voucher's requisition and forwards them to /prehire/apply/[token].
 * Auth-bypassed in middleware (isPreHireRedeemRoute).
 */
export default async function PrehireRedeemPage({ searchParams }: Props) {
  const initialCode = searchParams?.code?.trim() ?? "";
  // Surface a spent/expired/deactivated code before the applicant fills the
  // form in, rather than after they submit it (shared with every service).
  const blocked = await loadVoucherBlock("prehire", initialCode);
  return (
    <div className="min-h-screen bg-background">
      <header className="ara-hero relative overflow-hidden">
        <div className="mx-auto max-w-2xl px-6 pt-7 pb-20">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-10 max-w-2xl">
            <span className="ara-eyebrow text-accent">
              <UserSearch className="h-3 w-3" /> VIFM Pre-Hire®
            </span>
            <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Redeem your screening code
            </h1>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              Enter the code your employer or recruiter gave you to begin your pre-employment
              screening. No account needed - it runs in your browser.
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-2xl px-6 pb-16">
        {blocked ? (
          <VoucherBlockedCard block={blocked} code={initialCode} redeemPath="/prehire/redeem" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your details</CardTitle>
            </CardHeader>
            <CardContent>
              <RedeemForm
                initialCode={initialCode}
                initialCompany={searchParams?.company?.trim() ?? ""}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
