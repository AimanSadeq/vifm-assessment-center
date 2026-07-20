import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { voucherBlockCopy, type VoucherBlock } from "@/lib/vouchers/status";

/**
 * Shown in place of the redeem form when a voucher code can no longer be
 * claimed, so the delegate learns why BEFORE filling the form in rather than
 * after submitting it (trial feedback from Asaad on Fluent and Amal on ARC).
 *
 * Bilingual: once the form is replaced there is no language toggle on the page,
 * and these codes go to Arabic-speaking delegates, so both languages are shown.
 */
export function VoucherBlockedCard({
  block,
  code,
  redeemPath,
}: {
  block: VoucherBlock;
  /** The code as typed/linked; displayed so the delegate can quote it. */
  code: string;
  /** This service's redeem route, for the "try another code" affordance. */
  redeemPath: string;
}) {
  const copy = voucherBlockCopy(block);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <CardTitle className="break-all font-mono text-base">{code.toUpperCase()}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">The code on your invitation link</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <div>
          <p className="font-semibold text-foreground">{copy.en.title}</p>
          <p className="mt-1 text-muted-foreground">{copy.en.body}</p>
        </div>
        <div dir="rtl" className="border-t border-border pt-4">
          <p className="font-semibold text-foreground">{copy.ar.title}</p>
          <p className="mt-1 text-muted-foreground">{copy.ar.body}</p>
        </div>
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Have a different code?{" "}
          <Link href={redeemPath} className="font-medium text-foreground underline underline-offset-2">
            Enter it here
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
