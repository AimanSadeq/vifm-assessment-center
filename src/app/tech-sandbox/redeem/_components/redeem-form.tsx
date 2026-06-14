"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { redeemVoucherAction } from "../actions";

export function RedeemForm({
  initialCode,
  initialName,
  initialEmail,
  initialCompany,
}: {
  initialCode?: string;
  initialName?: string;
  initialEmail?: string;
  initialCompany?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [company, setCompany] = useState(initialCompany ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await redeemVoucherAction({ code, name, email, company });
    if (res.ok) {
      router.push(`/tech-sandbox/${res.token}`);
      return;
    }
    setBusy(false);
    setError(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Voucher code</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="VIFM-TECH-XXXX-XXXX" className="rounded-md border border-border bg-card px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-[#5391D5]" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Full name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-md border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-[#5391D5]" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-md border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-[#5391D5]" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Company</span>
        <input value={company} onChange={(e) => setCompany(e.target.value)} required className="rounded-md border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-[#5391D5]" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-md bg-[#010131] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
        {busy ? "Starting…" : "Start assessment"}
      </button>
    </form>
  );
}
