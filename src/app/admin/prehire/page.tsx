import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Plus, UserSearch, Building2, Users, ArrowRight, Briefcase } from "lucide-react";

export const dynamic = "force-dynamic";

type ReqRow = {
  id: string;
  title: string;
  level: string | null;
  status: string;
  organization_id: string | null;
  organizations: { name: string } | null;
  prehire_candidates: { count: number }[];
};

export default async function PreHireListPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prehire_requisitions")
    .select(
      "id, title, level, status, organization_id, organizations(name), prehire_candidates(count)"
    )
    .order("created_at", { ascending: false });

  const reqs = (data ?? []) as unknown as ReqRow[];
  const candCount = (r: ReqRow) => r.prehire_candidates?.[0]?.count ?? 0;
  const totalCandidates = reqs.reduce((sum, r) => sum + candCount(r), 0);
  const openCount = reqs.filter((r) => r.status === "open").length;

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="prehire-hero">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-20">
          <span className="ara-eyebrow text-[#FDA4AF]">
            <UserSearch className="h-3 w-3" /> Pre-employment screening
          </span>
          <h1 className="ara-numeral mt-3 text-3xl font-semibold leading-[1.1] text-white sm:text-4xl">
            Screen smarter. <span className="ara-accent-sweep">Shortlist with confidence.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
            Configurable screening funnels — competency quiz, English placement, and an AI
            behavioural interview — with a weighted composite, adverse-impact monitoring, and an
            audit trail. The score is a signal; a person always decides.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link
              href="/admin/prehire/new"
              className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-[#E11D48] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#be123c]"
            >
              <Plus className="h-4 w-4" /> New requisition
            </Link>

            {/* Stat strip */}
            <div className="flex flex-wrap items-stretch gap-3">
              <Stat value={reqs.length} label="Requisitions" />
              <Stat value={openCount} label="Open" />
              <Stat value={totalCandidates} label="Candidates" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Requisitions ─── */}
      <section className="mx-auto -mt-10 max-w-6xl px-6 pb-16">
        {error ? (
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-destructive">Couldn&apos;t load requisitions: {error.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Apply migration <code className="font-mono">00050</code> with{" "}
              <code className="font-mono">npx supabase db push</code>.
            </p>
          </div>
        ) : reqs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-12 text-center shadow-sm">
            <div className="ara-icon-rose flex h-12 w-12 items-center justify-center rounded-xl">
              <UserSearch className="h-6 w-6" />
            </div>
            <p className="font-medium text-[#010131]">No requisitions yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a requisition to start screening candidates for a client role.
            </p>
            <Link
              href="/admin/prehire/new"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#E11D48] px-4 py-2 text-sm font-semibold text-white hover:bg-[#be123c]"
            >
              <Plus className="h-4 w-4" /> New requisition
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reqs.map((r) => (
              <Link key={r.id} href={`/admin/prehire/${r.id}`} className="block h-full">
                <div className="ara-tile flex h-full flex-col p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="ara-icon-rose flex h-10 w-10 items-center justify-center rounded-xl">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                  </div>
                  <h3 className="font-semibold text-[#010131]">{r.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {r.organizations?.name ?? "—"}
                    </span>
                    {r.level && <span>· {r.level}</span>}
                  </div>
                  <div className="mt-4 flex flex-1 items-end justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm text-[#010131]">
                      <Users className="h-4 w-4 text-[#E11D48]" />
                      <span className="font-semibold tabular-nums">{candCount(r)}</span>
                      <span className="text-muted-foreground">candidate{candCount(r) === 1 ? "" : "s"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#E11D48]">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur">
      <div className="ara-numeral text-2xl font-semibold leading-none text-[#FDA4AF]">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-white/60">{label}</div>
    </div>
  );
}
