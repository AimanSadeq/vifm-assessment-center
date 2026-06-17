import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listFunctions, listBlocksForReview } from "@/lib/technical-sandbox/service";
import { BackLink } from "@/components/shared/back-link";
import { BlockReviewConsole } from "./_components/block-review-console";

export const dynamic = "force-dynamic";

export default async function SandboxBlocksReviewPage({
  searchParams,
}: {
  searchParams: { function?: string };
}) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  // Active functions are the ones with seeded pillars/blocks worth reviewing.
  const functions = await listFunctions(true);
  const selectedKey = searchParams.function ?? functions[0]?.key ?? null;
  const selected = functions.find((f) => f.key === selectedKey) ?? null;
  const pillars = selected ? await listBlocksForReview(selected.id) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <BackLink href="/admin/tech-sandbox" label="Technical Assessment" history />
      <header>
        <h1 className="text-2xl font-semibold text-[#010131]">Sandbox task review</h1>
        <p className="text-sm text-muted-foreground">
          SME approval workflow for the hands-on (performance) tasks. A certified combined credential
          requires SME-approved tasks; unapproved tasks still run as an indicative result. (The MCQ
          knowledge bank is reviewed separately under Functions.)
        </p>
      </header>

      {functions.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No active functions. Seed + activate a function first.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {functions.map((f) => (
              <Link
                key={f.id}
                href={`/admin/tech-sandbox/sandbox-blocks?function=${encodeURIComponent(f.key ?? "")}`}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  selectedKey === f.key
                    ? "border-[#010131] bg-[#010131] text-white"
                    : "hover:bg-muted"
                }`}
              >
                {f.nodeId ? `${f.nodeId} ` : ""}
                {f.nameEn}
              </Link>
            ))}
          </div>
          <BlockReviewConsole pillars={pillars} />
        </>
      )}
    </div>
  );
}
