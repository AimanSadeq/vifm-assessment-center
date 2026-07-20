import { AlertCircle, Languages } from "lucide-react";
import Link from "next/link";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServiceClient } from "@/lib/supabase/server";
import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem a code · VIFM Fluent®" };

type Props = { searchParams?: { code?: string } };

export default async function FluentRedeemPage({ searchParams }: Props) {
  const initialCode = searchParams?.code?.trim() ?? "";

  // When the link carries a code, resolve the voucher so we can (a) show the
  // client it's for, and (b) tell the candidate UP FRONT when the code can no
  // longer be used - a trial finding: re-opening a spent link showed a clean,
  // working form with no sign it had already been redeemed, so the only feedback
  // came after filling the whole form in. The three conditions below mirror the
  // claim RPC exactly (status active, seats left, not expired).
  let clientName: string | null = null;
  let blocked: { title: string; body: string } | null = null;
  if (initialCode) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("eng_fluent_vouchers")
        .select("client_name, status, max_uses, used_count, expires_at")
        .eq("code", initialCode.toUpperCase())
        .maybeSingle<{
          client_name: string | null; status: string;
          max_uses: number; used_count: number; expires_at: string | null;
        }>();
      if (data) {
        const expired = !!data.expires_at && new Date(data.expires_at).getTime() <= Date.now();
        const seatsLeft = (data.max_uses ?? 1) - (data.used_count ?? 0);
        if (data.status !== "active") {
          blocked = {
            title: "This code is no longer active",
            body: "The organisation that issued this code has deactivated it. Please contact them for a new link.",
          };
        } else if (expired) {
          blocked = {
            title: "This code has expired",
            body: "This placement link is past its valid-until date. Please contact the organisation that invited you for a new one.",
          };
        } else if (seatsLeft <= 0) {
          // A cohort code can carry many seats - don't tell a 50-seat client
          // their code "can be used once".
          const multi = (data.max_uses ?? 1) > 1;
          blocked = multi
            ? {
                title: "This code has no places left",
                body: `All ${data.max_uses} places on this code have been taken. Please ask the organisation that invited you for a new code.`,
              }
            : {
                title: "This code has already been used",
                body: "Each access code can be used once, and this one has been redeemed. If you already took the placement, your result was sent to the organisation that invited you. If you think this is a mistake, contact them for a new code.",
              };
        } else {
          clientName = data.client_name;
        }
      }
    } catch {
      /* tolerant - the form still validates the code on submit */
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="fluent-hero">
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-20">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-10 max-w-2xl">
            <span className="ara-eyebrow text-[#9CC4EC]">
              <Languages className="h-3 w-3" /> VIFM Fluent® · English placement
            </span>
            <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {blocked ? blocked.title : "Redeem your access code"}
            </h1>
            {clientName && (
              <p className="mt-3 text-sm font-semibold text-[#9CC4EC]">English placement for {clientName}</p>
            )}
            {!blocked && (
              <p className="mt-3 text-base leading-relaxed text-white/75">
                Enter the voucher code your organisation gave you, then take a four-skill,
                CEFR-aligned English placement. No account needed.
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-2xl px-6 pb-16">
        {blocked ? (
          <Card>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-base font-mono">{initialCode.toUpperCase()}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">The code on your invitation link</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>{blocked.body}</p>
              <p className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                Have a different code? <Link href="/ac/fluent/redeem" className="font-medium text-foreground underline underline-offset-2">Enter it here</Link>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your details</CardTitle>
            </CardHeader>
            <CardContent>
              <RedeemForm initialCode={initialCode} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
