"use client";
// Admin: generate + manage technical sandbox voucher codes. Three methods:
//  - Named delegates: paste "Name, Email" lines or upload a CSV -> one personal
//    code each (ready to send per person).
//  - Single-use codes: N anonymous codes.
//  - One shared seat-pool code: one code, N seats.
import { useMemo, useRef, useState } from "react";
import type { FunctionRow } from "@/lib/technical-sandbox/service";
import type { VoucherRow } from "@/lib/technical-sandbox/vouchers";
import { generateVouchersAction, setVoucherStatusAction } from "../../actions";

type Mode = "delegates" | "single" | "pool";
type Delegate = { name: string; email: string };
type Assignment = { name: string; email: string; code: string };

function parseDelegates(text: string): Delegate[] {
  const out: Delegate[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // split on comma/tab/semicolon; supports "Name, email" or "email, Name" or pasted columns
    const parts = line.split(/[,\t;]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    let name = "";
    let email = "";
    for (const p of parts) {
      if (!email && /@/.test(p)) email = p;
      else if (!name) name = p;
    }
    if (!email && parts.length >= 2) email = parts[1];
    if (!name) name = email.split("@")[0] ?? "Delegate";
    // skip header rows
    if (/^name$/i.test(name) && /^e-?mail$/i.test(email)) continue;
    if (email) out.push({ name, email });
  }
  return out;
}

export function VouchersClient({
  functions,
  vouchers,
}: {
  functions: FunctionRow[];
  vouchers: VoucherRow[];
}) {
  const fnName = new Map(functions.map((f) => [f.id, `${f.nodeId ?? ""} ${f.nameEn}`.trim()]));
  const [functionId, setFunctionId] = useState(functions[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("delegates");
  const [count, setCount] = useState(20);
  const [organizationName, setOrganizationName] = useState("");
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [delegateText, setDelegateText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const parsedDelegates = useMemo(() => parseDelegates(delegateText), [delegateText]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setDelegateText((prev) => (prev ? prev + "\n" : "") + text);
    };
    reader.readAsText(file);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setNewCodes(null);
    setAssignments(null);
    const res = await generateVouchersAction({
      functionId,
      count: mode === "single" ? count : 1,
      organizationName: organizationName || undefined,
      label: label || undefined,
      maxUsesPerCode: mode === "pool" ? count : 1,
      expiresAt: expiresAt || undefined,
      delegates: mode === "delegates" ? parsedDelegates : undefined,
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setNewCodes(res.codes);
    setAssignments(res.assignments.length ? res.assignments : null);
  }

  async function toggle(id: string, status: string) {
    await setVoucherStatusAction({ id, status: status === "active" ? "disabled" : "active" });
    window.location.reload();
  }

  const redeemUrl = (code: string) => `${origin}/tech-sandbox/redeem?code=${code}`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-medium text-foreground">Generate voucher codes</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Function</span>
            <select value={functionId} onChange={(e) => setFunctionId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground">
              {functions.map((f) => (
                <option key={f.id} value={f.id}>{f.nodeId} · {f.nameEn}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Method</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground">
              <option value="delegates">Named delegates (import CSV / paste names + emails)</option>
              <option value="single">Anonymous single-use codes (one per delegate)</option>
              <option value="pool">One shared code (seat pool)</option>
            </select>
          </label>

          {mode === "delegates" ? (
            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Delegates — &ldquo;Name, email&rdquo; one per line</span>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-[#5391D5] hover:underline">
                  Upload CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
              </div>
              <textarea
                value={delegateText}
                onChange={(e) => setDelegateText(e.target.value)}
                rows={6}
                placeholder={"John Smith, john@client.com\nSara Ali, sara@client.com"}
                className="w-full rounded-md border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {parsedDelegates.length} delegate(s) detected. From Excel: copy the Name and Email columns and
                paste, or Save As CSV and upload.
              </p>
            </div>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{mode === "single" ? "How many codes" : "Seats in the pool"}</span>
              <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
            </label>
          )}

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
        <button onClick={generate} disabled={busy || !functionId || (mode === "delegates" && parsedDelegates.length === 0)} className="mt-3 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Generating…" : mode === "delegates" ? `Generate ${parsedDelegates.length} code(s)` : "Generate"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {assignments && (
          <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800">{assignments.length} delegate code(s) generated</span>
              <button
                onClick={() => {
                  const csv = "name,email,code,redeem_url\n" + assignments.map((a) => `${a.name},${a.email},${a.code},${redeemUrl(a.code)}`).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = "technical-delegate-codes.csv";
                  link.click();
                }}
                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white"
              >
                Download CSV (name · email · code · link)
              </button>
            </div>
            <div className="max-h-52 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground"><tr><th className="p-1 text-start">Name</th><th className="p-1 text-start">Email</th><th className="p-1 text-start">Code</th></tr></thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.code} className="border-t border-emerald-200/60">
                      <td className="p-1">{a.name}</td>
                      <td className="p-1">{a.email}</td>
                      <td className="p-1 font-mono">{a.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {newCodes && !assignments && (
          <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800">{newCodes.length} code(s) generated</span>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard?.writeText(newCodes.join("\n"))} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">Copy codes</button>
                <button
                  onClick={() => {
                    const csv = "code,redeem_url\n" + newCodes.map((c) => `${c},${redeemUrl(c)}`).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = "technical-vouchers.csv";
                    link.click();
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
            <p className="mt-2 text-xs text-emerald-700">Delegates redeem at <span className="font-mono">{origin}/tech-sandbox/redeem</span></p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-medium text-foreground">Existing vouchers</h3>
        {vouchers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vouchers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">Code</th>
                  <th className="p-2 text-start">Delegate</th>
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
                    <td className="p-2 text-muted-foreground">{v.assignedName ? `${v.assignedName}` : "-"}{v.assignedEmail ? ` · ${v.assignedEmail}` : ""}</td>
                    <td className="p-2 text-muted-foreground">{fnName.get(v.functionId) ?? "-"}</td>
                    <td className="p-2 text-muted-foreground">{v.organizationName ?? "-"}</td>
                    <td className="p-2 text-end">{v.usedCount} / {v.maxUses}</td>
                    <td className="p-2"><span className={v.status === "active" ? "text-emerald-700" : "text-muted-foreground"}>{v.status}</span></td>
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
