import Link from "next/link";
import { Ticket } from "lucide-react";

// Shared header for every voucher-issuance page: a dark "VIFM · VOUCHERS /
// Issue vouchers" bar + a service-tab row so an admin can jump between the
// seven voucher surfaces from any one of them. Each page passes its own
// `active` key; the matching tab is highlighted. Keeps the per-service body
// (Generate codes + options + issued table) below it.
export type VoucherService =
  | "fluent"
  | "logica"
  | "persona"
  | "techno"
  | "arc"
  | "prehire"
  | "role-readiness";

const TABS: { key: VoucherService; label: string; href: string }[] = [
  { key: "fluent", label: "Fluent", href: "/ac/fluent/vouchers" },
  { key: "logica", label: "Logica", href: "/ac/cognitive/vouchers" },
  { key: "persona", label: "Persona", href: "/ac/persona/vouchers" },
  { key: "techno", label: "Techno", href: "/admin/tech-sandbox/vouchers" },
  { key: "arc", label: "ARC", href: "/ara/admin/vouchers" },
  { key: "prehire", label: "Pre-Hire", href: "/admin/vouchers" },
  { key: "role-readiness", label: "Role Readiness", href: "/admin/bespoke/roles" },
];

export function VoucherNav({ active }: { active: VoucherService }) {
  return (
    <div className="rounded-xl bg-[#010131] px-5 py-4 text-white">
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-[#5391D5]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5391D5]">
          VIFM &middot; Vouchers
        </p>
      </div>
      <h1 className="mt-1 text-2xl font-bold text-white">Issue vouchers</h1>
      <nav className="mt-3 flex flex-wrap gap-2" aria-label="Voucher services">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#EDF1F5] text-[#010131]"
                  : "bg-white/10 text-white/85 ring-1 ring-white/20 hover:bg-white/20"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
