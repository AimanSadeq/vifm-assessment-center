import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Redeem Voucher · AI Readiness Compass" };

/** Public voucher redemption - no account required (auth-bypassed in middleware). */
export default function RedeemVoucherPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-16">
        <RedeemForm />
      </div>
    </div>
  );
}
