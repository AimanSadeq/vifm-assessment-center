import Link from "next/link";
import { ArrowLeft, History, RefreshCw } from "lucide-react";
import registerData from "@/data/fix-register.generated.json";
import { FixRegisterClient, type FixService } from "./_components/register-client";

export const metadata = { title: "Fix Register - VIFM Caliber" };

type RegisterData = {
  generatedAt: string;
  latestFixDate: string;
  totalEntries: number;
  serviceCount: number;
  services: FixService[];
};

const data = registerData as RegisterData;

function fmt(iso: string): string {
  // Render the build timestamp without depending on the viewer's locale drift.
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  } catch {
    return iso;
  }
}

export default function FixRegisterPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>

      <div className="mb-6 flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#010131] text-white">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[#010131]">Fix Register</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A live, per-service record of every change shipped to Caliber, generated from the deployment
            history. Each entry carries its fix date, the engineer who made it, an optional requester, and
            the full explanation. Expand any row to read the detail.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={String(data.totalEntries)} label="Fixes logged" />
        <Stat value={String(data.serviceCount)} label="Services" />
        <Stat value={data.latestFixDate || "-"} label="Latest fix" />
        <Stat value={fmt(data.generatedAt)} label="Register refreshed" small />
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-[#5391D5]/30 bg-[#5391D5]/[0.05] px-4 py-3 text-xs text-[#26324a]">
        <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5391D5]" />
        <span>
          This register refreshes automatically on every release - it always reflects what is live in
          production. To attribute a fix to a requester, add a <code className="rounded bg-white/70 px-1 py-0.5 font-mono">Requested-by: Name</code> line
          to the change; it appears here on the next deploy.
        </span>
      </div>

      <FixRegisterClient services={data.services} />
    </div>
  );
}

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className={small ? "font-mono text-xs font-semibold text-[#010131]" : "text-xl font-bold tabular-nums text-[#010131]"}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
