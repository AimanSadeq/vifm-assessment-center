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
            A live, per-service record of every change shipped to Caliber. Each entry is written in plain
            English - what changed and why it matters - alongside its date, the engineer who made it, and an
            optional requester. Expand any row for the technical detail.
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

      {/* Plain-language legend for the type labels. */}
      <div className="mb-5 rounded-xl border bg-card p-4">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What the labels mean</p>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-start gap-2.5 text-sm">
              <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.cls}`}>{l.label}</span>
              <span className="text-muted-foreground">{l.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <FixRegisterClient services={data.services} />
    </div>
  );
}

const LEGEND = [
  { label: "Critical", cls: "bg-rose-600 text-white", desc: "An urgent security or data problem, fixed as a priority." },
  { label: "Security", cls: "bg-amber-100 text-amber-800 border border-amber-200", desc: "A change that makes the platform safer or closes a loophole." },
  { label: "Audit", cls: "bg-sky-100 text-sky-800 border border-sky-200", desc: "Found during a deep, deliberate review of a module." },
  { label: "Fix", cls: "bg-slate-100 text-slate-700 border border-slate-200", desc: "Something was not working correctly and has been put right." },
  { label: "Feature", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200", desc: "Something new you can now do." },
  { label: "Change", cls: "bg-slate-100 text-slate-600 border border-slate-200", desc: "An improvement or adjustment to how something works." },
] as const;

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className={small ? "font-mono text-xs font-semibold text-[#010131]" : "text-xl font-bold tabular-nums text-[#010131]"}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
