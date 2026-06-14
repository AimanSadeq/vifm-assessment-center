import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getAnswerKey } from "@/lib/technical-sandbox/service";

export const dynamic = "force-dynamic";

export default async function ModelAnswersPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const functions = await getAnswerKey();

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <Link href="/admin/tech-sandbox" className="text-sm text-[#5391D5] hover:underline">
        Back to Technical Sandbox
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Model Answers (admin only)</h1>
        <p className="text-sm text-muted-foreground">
          The answer key for each active function: model values, formulas, master SQL, and the
          weighted checkpoints used to grade and band each skill block.
        </p>
      </div>

      {functions.length === 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No active functions. Apply migration 00077 to seed FP&amp;A 1.7.
        </p>
      )}

      {functions.map((fn) => (
        <section key={fn.functionId} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {fn.nodeId ? `${fn.nodeId} · ` : ""}
            {fn.nameEn}
          </h2>
          {fn.blocks.map((b) => (
            <div key={b.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-foreground">{b.nameEn}</h3>
                <span className="text-xs text-muted-foreground">
                  {b.pillarNameEn} · {b.engineType} · {Math.round(b.timeLimitSeconds / 60)} min
                  {b.frameworkRef ? ` · ${b.frameworkRef}` : ""}
                </span>
              </div>

              {b.cells && b.cells.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="text-start">
                        <th className="p-1.5 text-start">Cell</th>
                        <th className="p-1.5 text-start">Line</th>
                        <th className="p-1.5 text-start">Model formula</th>
                        <th className="p-1.5 text-end">Expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.cells.map((c) => (
                        <tr key={c.ref} className="border-t border-border">
                          <td className="p-1.5 font-mono text-xs">{c.ref}</td>
                          <td className="p-1.5 text-muted-foreground">{c.label}</td>
                          <td className="p-1.5 font-mono text-xs" dir="ltr">{c.formula ?? "-"}</td>
                          <td className="p-1.5 text-end font-medium">{c.expected ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {b.fields && b.fields.length > 0 && (
                <table className="w-full text-sm">
                  <tbody>
                    {b.fields.map((f) => (
                      <tr key={f.id} className="border-t border-border">
                        <td className="p-1.5 text-muted-foreground">{f.label}</td>
                        <td className="p-1.5 text-end font-medium">{f.expected ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {b.masterQuery && (
                <pre className="overflow-x-auto rounded-md bg-[#0b1220] p-3 text-xs text-slate-100" dir="ltr">
                  {b.masterQuery}
                </pre>
              )}

              <div className="mt-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Checkpoints (weight)
                </div>
                <ul className="space-y-0.5 text-xs">
                  {b.checkpoints.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="text-foreground">
                        {c.label}
                        {c.target ? ` · ${c.target}` : ""}
                        {c.field ? ` · ${c.field}` : ""}
                        {c.expected != null ? ` = ${c.expected}` : ""}
                      </span>
                      <span className="text-muted-foreground">×{c.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
