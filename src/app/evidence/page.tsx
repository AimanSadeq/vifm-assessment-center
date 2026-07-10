import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, BookOpen, ArrowUpRight, ShieldCheck, FileDown } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { COMPETENCY_COUNT } from "@/lib/competencies/framework-meta";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { EVIDENCE_INSTRUMENTS } from "@/lib/evidence/evidence-catalogue";
import { METHODOLOGY_BRIEFS } from "@/lib/reports/methodology-briefs-registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research & validity - evidence base | VIFM Caliber",
  description:
    "The item types, counts, validity claims and literature sources behind every VIFM Caliber assessment - proof the questions are grounded in established research.",
};

/**
 * Live item counts per instrument. Best-effort: each query is independent and
 * tolerant of a missing table (returns null -> shows "-"). Framework-defined
 * instruments (AC, Persona) use the canonical constant, which IS the live size.
 */
async function loadCounts(): Promise<Record<string, number | null>> {
  const sb = createServiceClient();
  const counts: Record<string, number | null> = {
    competencies: COMPETENCY_COUNT,
    ara_questions: null,
    persona_competencies: BEHAVIORAL_COMPETENCIES.length,
    cognitive_items: null,
    fluent_items: null,
    technical_tasks: null,
    reflect_behaviors: null,
    prehire_stages: 3,
  };

  const headCount = async (table: string, apply?: (q: ReturnType<typeof sb.from>) => unknown): Promise<number | null> => {
    try {
      let q = sb.from(table).select("*", { count: "exact", head: true }) as unknown as {
        eq: (c: string, v: unknown) => typeof q;
        then: Promise<{ count: number | null; error: unknown }>["then"];
      };
      if (apply) q = apply(q as never) as never;
      const { count, error } = (await (q as unknown as Promise<{ count: number | null; error: unknown }>));
      return error ? null : count ?? null;
    } catch {
      return null;
    }
  };

  // Competencies (authoritative count from the DB; falls back to the constant).
  counts.competencies = (await headCount("competencies")) ?? COMPETENCY_COUNT;
  counts.fluent_items = await headCount("eng_fluent_items");
  counts.technical_tasks = await headCount("technical_skill_blocks");
  counts.reflect_behaviors = await headCount("reflect_behaviors");

  // ARA: questions on the currently-active bank version (layer-1, active).
  try {
    const { data: bank } = await sb
      .from("ara_question_bank_versions")
      .select("id")
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();
    if (bank?.id) {
      const { count } = await sb
        .from("ara_questions")
        .select("*", { count: "exact", head: true })
        .eq("version_id", bank.id)
        .eq("is_active", true);
      counts.ara_questions = count ?? null;
    }
  } catch {
    counts.ara_questions = null;
  }

  return counts;
}

const fmt = (n: number | null) => (n == null ? "-" : String(n));

export default async function EvidencePage() {
  const counts = await loadCounts();

  const grounded = EVIDENCE_INSTRUMENTS.filter((i) => i.tier === "grounded").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <BackLink href="/" label="Back" history />

        {/* Header */}
        <div className="mt-2">
          <span className="ara-eyebrow text-accent">
            <FlaskConical className="h-3 w-3" /> Evidence base
          </span>
          <h1 className="ara-numeral mt-2 text-2xl font-semibold leading-tight text-[#010131] sm:text-3xl">
            Research &amp; validity
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The item types, counts, validity claims and literature sources behind every Caliber
            assessment - so a client or regulator can see the questions are grounded in established
            research, not invented. Item counts are read live from the platform database.
          </p>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                Literature-grounded
              </span>
              <span className="text-muted-foreground">validated framework or published instrument</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                Indicative
              </span>
              <span className="text-muted-foreground">AI-generated, pending a validation study</span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-6 space-y-4">
          {EVIDENCE_INSTRUMENTS.map((inst) => {
            const count = counts[inst.countKey];
            const isGrounded = inst.tier === "grounded";
            return (
              <section key={inst.key} className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                {/* Top row: name + tier + count */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[#010131] sm:text-lg">{inst.name}</h2>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          isGrounded
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                            : "border-amber-200 bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isGrounded ? "Literature-grounded" : "Indicative"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{inst.construct}</p>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-1.5 rounded-lg bg-[#010131]/[0.04] px-3 py-2 sm:flex-col sm:items-end sm:gap-0">
                    <span className="ara-numeral text-2xl font-semibold leading-none text-[#010131]">{fmt(count)}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{inst.countLabel}</span>
                  </div>
                </div>

                {/* Detail grid */}
                <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Field label="Item types">{inst.itemTypes}</Field>
                  <Field label="Validity claim">{inst.validity}</Field>
                  <Field label="Reliability evidence">{inst.reliability}</Field>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source in the literature</dt>
                    <dd className="mt-1">
                      <ul className="space-y-1">
                        {inst.literature.map((cite) => (
                          <li key={cite} className="flex gap-1.5 text-[13px] leading-snug text-foreground">
                            <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                            <span>{cite}</span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>

                {/* Docs */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Supporting docs:</span>
                  {inst.docs.map((d) => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-[#010131] hover:border-accent hover:text-accent"
                    >
                      {d.label} <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Methodology briefs - one branded PDF per service */}
        <div className="mt-8">
          <div className="flex items-center gap-2">
            <FileDown className="h-4 w-4 text-accent" />
            <h2 className="text-lg font-semibold text-[#010131]">Methodology briefs</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A plain-language methodology brief for every VIFM service - what it measures, how it is
            scored, what the deliverables are, and what it is honestly not. Branded PDF, no account needed.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {METHODOLOGY_BRIEFS.map((b) => (
              <a
                key={b.slug}
                href={`/api/methodology/${b.slug}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm transition hover:border-accent"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#010131]">{b.service}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{b.tagline}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-[#010131] group-hover:border-accent group-hover:text-accent">
                  <FileDown className="h-3 w-3" /> PDF
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Honest framing footer */}
        <div className="mt-6 rounded-xl border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              <span className="font-semibold text-foreground">{grounded} of {EVIDENCE_INSTRUMENTS.length} instruments are literature-grounded.</span>{" "}
              Where an instrument is still <span className="font-medium">indicative</span> (AI-generated items, no local norms or IRT
              calibration yet), it is labelled as such and issues no credential - overclaiming validity would undermine the very
              defensibility this page exists to demonstrate. Reliability and norm studies are documented as the path to full
              validation, not as already met.
            </span>
          </p>
        </div>

        <div className="mt-4 text-[11px] text-muted-foreground">
          <span>Virginia Institute of Finance and Management - VIFM Caliber</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[13px] leading-snug text-foreground">{children}</dd>
    </div>
  );
}
