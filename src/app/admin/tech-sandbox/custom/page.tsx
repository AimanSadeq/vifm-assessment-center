import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listFunctions, getCustomBuilderData } from "@/lib/technical-sandbox/service";
import { validateTalentLens } from "@/lib/constants/ara-individual-factors";
import { BackLink } from "@/components/shared/back-link";
import { CustomBuilder } from "./_components/custom-builder";

export const dynamic = "force-dynamic";

export default async function CustomBuilderPage({
  searchParams,
}: {
  searchParams: { function?: string; lens?: string };
}) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  // Talent lens captured from the launching pillar (00135): drives whether the
  // report carries the VIFM Academy course block. NULL = development framing.
  const talentLens = validateTalentLens(searchParams.lens);
  const functions = await listFunctions(true);
  const selectedKey = searchParams.function ?? functions[0]?.key ?? null;
  const selected = functions.find((f) => f.key === selectedKey) ?? null;
  const builder = selected ? await getCustomBuilderData(selected.id) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <BackLink href="/admin/tech-sandbox" label="Techno®" history />
      <header>
        <h1 className="text-2xl font-semibold text-[#010131]">Custom assessment builder</h1>
        <p className="text-sm text-muted-foreground">
          Assemble a narrower sitting from one function - pick a subset of its knowledge skills
          and/or hands-on tasks. A custom sitting is an indicative development read (no credential),
          so it is ideal for a focused skills check or a single-competency deep dive.
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
                href={`/admin/tech-sandbox/custom?function=${encodeURIComponent(f.key ?? "")}`}
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

          {builder ? (
            <CustomBuilder data={builder} />
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Could not load this function. Try another.
            </p>
          )}
        </>
      )}
    </div>
  );
}
