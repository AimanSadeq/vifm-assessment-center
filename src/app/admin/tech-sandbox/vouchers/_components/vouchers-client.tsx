"use client";
// Admin: generate + manage technical sandbox voucher codes. A client gets a
// batch of codes to self-distribute; each delegate redeems at /tech-sandbox/redeem.
import { useState } from "react";
import type { FunctionRow } from "@/lib/technical-sandbox/service";
import type { VoucherRow } from "@/lib/technical-sandbox/vouchers";
import { generateVouchersAction, setVoucherStatusAction } from "../../actions";

export function VouchersClient({
  functions,
  vouchers,
}: {
  functions: FunctionRow[];
  vouchers: VoucherRow[];
}) {
  const fnName = new Map(functions.map((f) => [f.id, `${f.nodeId ?? ""} ${f.nameEn}`.trim()]));
  const [functionId, setFunctionId] = useState(functions[0]?.id ?? "");
  const [count, setCount] = useState(20);
  const [organizationName, setOrganizationName] = useState("");
  const [label, setLabel] = useState("");
  const [poolMode, setPoolMode] = useState<"single" | "pool">("single");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setNewCodes(null);
    const res = await generateVouchersAction({
      functionId,
      count: poolMode === "single" ? count : 1,
      organizationName: organizationName || undefined,
      label: label || undefined,
      maxUsesPerCode: poolMode === "single" ? 1 : count,
      expiresAt: expiresAt || undefined,
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setNewCodes(res.codes);
  }

  async function toggle(id: string, status: string) {
    await setVoucherStatusAction({ id, status: status === "active" ? "disabled" : "active" });
    window.location.reload();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium text-foreground">Generate voucher codes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Function</span>
            <select value={functionId} onChange={(e) => setFunctionId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground">
              {functions.map((f) => (
                <option key={f.id} value={f.id}>{f.nodeId} · {f.nameEn}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Mode</span>
            <select value={poolMode} onChange={(e) => setPoolMode(e.target.value as "single" | "pool")} className="rounded-md border border-border bg-card px-3 py-2 text-foreground">
              <option value="single">Single-use codes (one per delegate)</option>
              <option value="pool">One shared code (seat pool)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{poolMode === "single" ? "How many codes" : "Seats in the pool"}</span>
            <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Client / organization</span>
            <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Label (optional)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. ADNOC FP&A pilot" className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Expires (optional)</span>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
        </div>
        <button onClick={generate} disabled={busy || !functionId} className="mt-3 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          Generate
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {newCodes && (
          <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800">{newCodes.length} code(s) generated</span>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard?.writeText(newCodes.join("\n"))} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">Copy codes</button>
                <button
                  onClick={() => {
                    const csv = "code,redeem_url\n" + newCodes.map((c) => `${c},${origin}/tech-sandbox/redeem?code=${c}`).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "technical-vouchers.csv";
                    a.click();
                  }}
                  className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-800"
                >
                  Download CSV
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-xs text-slate-700">
              {newCodes.map((c) => <div key={c}>{c}</div>)}
            </div>
            <p className="mt-2 text-xs text-emerald-700">
              Delegates redeem at <span className="font-mono">{origin}/tech-sandbox/redeem</span>
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium text-foreground">Existing vouchers</h2>
        {vouchers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vouchers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">Code</th>
                  <th className="p-2 text-start">Function</th>
                  <th className="p-2 text-start">Client</th>
                  <th className="p-2 text-end">Used / Max</th>
                  <th className="p-2 text-start">Status</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="p-2 font-mono text-xs">{v.code}</td>
                    <td className="p-2 text-muted-foreground">{fnName.get(v.functionId) ?? "-"}</td>
                    <td className="p-2 text-muted-foreground">{v.organizationName ?? "-"}</td>
                    <td className="p-2 text-end">{v.usedCount} / {v.maxUses}</td>
                    <td className="p-2">
                      <span className={v.status === "active" ? "text-emerald-700" : "text-muted-foreground"}>{v.status}</span>
                    </td>
                    <td className="p-2 text-end">
                      <button onClick={() => toggle(v.id, v.status)} className="text-xs text-[#5391D5] hover:underline">
                        {v.status === "active" ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
