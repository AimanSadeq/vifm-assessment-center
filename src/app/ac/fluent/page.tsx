import Link from "next/link";
import {
  ArrowLeft, Languages, Users, UserCheck, ClipboardCheck,
  BookOpen, Headphones, PenLine, Mic, CheckCircle2,
} from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { FluentClient } from "./_components/fluent-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VIFM Fluent · English placement (prototype)",
};

type Props = {
  searchParams?: { candidateId?: string; engagementId?: string };
};

// Hero skill chips. The note on each names *how* the skill is scored, which
// is Fluent's differentiator - receptive skills auto-score, productive skills
// are graded against the CEFR rubric. Deliberately vendor-neutral (capability,
// not implementation) so the copy outlives any model/provider swap.
const SKILLS = [
  { icon: BookOpen, label: "Reading", note: "Auto-scored" },
  { icon: Headphones, label: "Listening", note: "Audio · auto-scored" },
  { icon: PenLine, label: "Writing", note: "CEFR rubric-scored" },
  { icon: Mic, label: "Speaking", note: "Spoken · CEFR + pronunciation" },
] as const;

export default async function FluentPage({ searchParams }: Props) {
  const aiConfigured = isAIConfigured();

  // Optional candidate binding: launch /ac/fluent?candidateId=… to attach the
  // result to a candidate record. Tolerant - anonymous self-serve if absent.
  const candidateId = searchParams?.candidateId?.trim() || null;
  let candidateName: string | null = null;
  let candidateEmail: string | null = null;
  let engagementId: string | null = searchParams?.engagementId?.trim() || null;
  if (candidateId) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("candidates")
        .select("full_name, email, engagement_id")
        .eq("id", candidateId)
        .single();
      if (data) {
        candidateName = (data.full_name as string) ?? null;
        candidateEmail = (data.email as string) ?? null;
        engagementId = engagementId ?? ((data.engagement_id as string) ?? null);
      }
    } catch {
      /* candidate lookup failed - fall back to anonymous mode */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero ─── */}
      <header className="fluent-hero">
        <div className="mx-auto max-w-5xl px-6 pt-7 pb-24">
          {/* Top bar: logo + module nav */}
          <div className="mb-12 flex items-center justify-between gap-4">
            <VifmLogo variant="white" size="sm" />
            <nav className="flex items-center gap-2">
              <Link
                href="/ac/fluent/cohort"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <Users className="h-3.5 w-3.5" /> Cohort report
              </Link>
              <Link
                href="/ac/fluent/calibration"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <ClipboardCheck className="h-3.5 w-3.5" /> Scoring calibration
              </Link>
              <Link
                href="/admin"
                className="ms-1 hidden items-center gap-1 text-xs text-white/70 transition-colors hover:text-white sm:inline-flex"
              >
                <ArrowLeft className="h-3 w-3" /> Assessment Center
              </Link>
            </nav>
          </div>

          {/* Headline block */}
          <div className="max-w-3xl">
            <span className="ara-eyebrow text-[#9CC4EC]">
              <Languages className="h-3 w-3" /> VIFM Fluent · AI English placement
            </span>
            <h1 className="ara-numeral mt-4 mb-4 text-4xl font-semibold leading-[1.07] text-white sm:text-5xl">
              Four skills, one CEFR level -{" "}
              <span className="fluent-sweep">in minutes</span>.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              Reading and Listening are AI-generated and auto-scored; Writing and
              Speaking are scored live against the CEFR criteria by our AI examiner -
              the part IELTS and TOEFL pay human examiners for. Speech is transcribed
              and scored for pronunciation. Bilingual English / Arabic, an indicative
              A1–C2 level, and feedback in minutes.
            </p>

            {/* Skill chips */}
            <div className="mt-7 flex flex-wrap gap-2.5">
              {SKILLS.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-white/85 backdrop-blur"
                >
                  <s.icon className="h-3.5 w-3.5 text-[#9CC4EC]" />
                  <span className="font-medium text-white">{s.label}</span>
                  <span className="text-white/55">{s.note}</span>
                </span>
              ))}
            </div>

            {/* Trust strip */}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/55">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-[#9CC4EC]" /> CEFR certificate
              </span>
              <span className="h-3 w-px bg-white/20" />
              <span>AI-assisted scoring</span>
              <span className="h-3 w-px bg-white/20" />
              <span>Indicative confidence band</span>
              <span className="h-3 w-px bg-white/20" />
              <span>Cohort reporting &amp; emailed result</span>
              <span className="h-3 w-px bg-white/20" />
              <span>Indicative placement - not a certified high-stakes score</span>
            </div>

            {/* CEFR reference — spell out the acronym used throughout */}
            <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-white/45">
              <span className="font-medium text-white/70">CEFR</span> is the Common European Framework of
              Reference for Languages, the international scale for language ability: A1 / A2 (basic user),
              B1 / B2 (independent user), C1 / C2 (proficient user).
            </p>
          </div>
        </div>
      </header>

      {/* ─── Start / flow (overlaps the hero like the rest of the portal) ─── */}
      <main className="relative z-10 mx-auto -mt-12 max-w-5xl px-6 pb-16">
        {candidateName && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#5391D5]/40 bg-[#5391D5]/5 px-4 py-3 text-sm text-[#010131] shadow-sm">
            <UserCheck className="h-4 w-4 shrink-0 text-[#5391D5]" />
            <span>
              This placement will be linked to candidate record{" "}
              <strong>{candidateName}</strong>.
            </span>
          </div>
        )}
        {!aiConfigured && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <strong>AI key not set.</strong> The test runs in fallback mode (a small
            static test + placeholder score) so you can see the flow. Set{" "}
            <code className="text-xs">ANTHROPIC_API_KEY</code> for live AI-generated
            items and real CEFR writing assessment.
          </div>
        )}
        <FluentClient
          candidateId={candidateId}
          engagementId={engagementId}
          prefillName={candidateName ?? undefined}
          prefillEmail={candidateEmail ?? undefined}
        />
      </main>
    </div>
  );
}
