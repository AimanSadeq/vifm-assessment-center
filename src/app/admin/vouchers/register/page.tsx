import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadVoucherRegister } from "@/lib/vouchers/register";
import { RegisterTable } from "./_components/register-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voucher register" };

/**
 * One read-only list of every voucher any service has issued. The per-service
 * managers on /admin/vouchers are where codes are created and revoked; this is
 * where the question "what has gone out, to whom, and has it been used" is
 * answered without opening eight tabs.
 */
export default async function VoucherRegisterPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const register = await loadVoucherRegister();
  return (
    <div className="space-y-6">
      <BackLink href="/admin/vouchers" label="Back to vouchers" history />
      <RegisterTable register={register} />
    </div>
  );
}
