import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";

export default function RedeemPage({
  searchParams,
}: {
  searchParams: { code?: string; email?: string; company?: string; name?: string };
}) {
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-1 text-xs uppercase tracking-wide text-[#5391D5]">VIFM · Technical Assessment</div>
        <h1 className="text-lg font-semibold text-foreground">Redeem your access code</h1>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Enter your voucher code and details to begin the assessment. It is timed once you start.
        </p>
        <RedeemForm
          initialCode={searchParams.code}
          initialName={searchParams.name}
          initialEmail={searchParams.email}
          initialCompany={searchParams.company}
        />
      </div>
    </div>
  );
}
