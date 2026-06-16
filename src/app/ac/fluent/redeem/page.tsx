import { Languages } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem a code · VIFM Fluent" };

type Props = { searchParams?: { code?: string } };

export default function FluentRedeemPage({ searchParams }: Props) {
  const initialCode = searchParams?.code?.trim() ?? "";
  return (
    <div className="min-h-screen bg-background">
      <header className="fluent-hero">
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-20">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-10 max-w-2xl">
            <span className="ara-eyebrow text-[#9CC4EC]">
              <Languages className="h-3 w-3" /> VIFM Fluent · English placement
            </span>
            <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Redeem your access code
            </h1>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              Enter the voucher code your organisation gave you, then take a four-skill,
              CEFR-aligned English placement. No account needed.
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-2xl px-6 pb-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <RedeemForm initialCode={initialCode} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
