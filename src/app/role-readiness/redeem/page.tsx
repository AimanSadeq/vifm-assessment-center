import { RedeemClient } from "./redeem-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem · Role Readiness · VIFM" };

export default function RoleReadinessRedeemPage({
  searchParams,
}: {
  searchParams?: { code?: string; email?: string; name?: string };
}) {
  return (
    <RedeemClient
      code={searchParams?.code ?? ""}
      emailPrefill={searchParams?.email ?? ""}
      namePrefill={searchParams?.name ?? ""}
    />
  );
}
