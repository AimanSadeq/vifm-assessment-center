import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { loadPersonaRoleOptions } from "@/lib/scoring/persona-roles";
import { RoleDesigner } from "./_components/role-designer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Persona · Design target roles" };

export default async function DesignTargetRolesPage() {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const roles = await loadPersonaRoleOptions();

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <Link href="/ac/persona" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to Persona
          </Link>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">Design target roles</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Pull in a job description, let the AI map it to the VIFM competency framework (domains and
            areas), set the weight and target per competency, and save it as a reusable target role.
            Saved roles are available wherever a role is picked - Persona hiring, vouchers, and the
            engagement wizard.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <RoleDesigner />

        {/* Existing roles */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#010131]">Existing target roles ({roles.length})</h2>
          {roles.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None yet. Design one above.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium text-[#111232]">{r.name}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{r.comps.length} competenc{r.comps.length === 1 ? "y" : "ies"}</span>
                    <Link href={`/admin/role-profiles/${r.id}`} className="text-[#5391D5] hover:underline">
                      Edit
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
