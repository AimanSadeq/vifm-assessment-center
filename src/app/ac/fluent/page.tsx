import Link from "next/link";
import { ArrowLeft, Languages, Users, UserCheck } from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { createServiceClient } from "@/lib/supabase/server";
import { FluentClient } from "./_components/fluent-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VIFM Fluent · English placement (prototype)",
};

type Props = {
  searchParams?: { candidateId?: string; engagementId?: string };
};

export default async function FluentPage({ searchParams }: Props) {
  const aiConfigured = isAIConfigured();

  // Optional candidate binding: launch /ac/fluent?candidateId=… to attach the
  // result to a candidate record. Tolerant — anonymous self-serve if absent.
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
      /* candidate lookup failed — fall back to anonymous mode */
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Assessment Center
          </Link>
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">VIFM Fluent</h1>
            <span className="ml-2 rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5391D5]">
              Prototype
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A bilingual English placement test across four skills.{" "}
            <strong>Reading</strong> and <strong>Listening</strong> are AI-generated and
            auto-scored; <strong>Writing</strong> and <strong>Speaking</strong> are scored
            live by Claude against the CEFR criteria — the part IELTS/TOEFL pay human
            examiners for. Speaking is transcribed with Whisper. You get an indicative CEFR
            level (A1–C2) with feedback in minutes, in English or Arabic.
          </p>
          <Link
            href="/ac/fluent/cohort"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#5391D5] hover:underline"
          >
            <Users className="h-3.5 w-3.5" /> View cohort report
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {candidateName && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#5391D5]/40 bg-[#5391D5]/5 px-4 py-3 text-sm text-[#010131]">
            <UserCheck className="h-4 w-4 text-[#5391D5]" />
            <span>
              This placement will be linked to candidate record{" "}
              <strong>{candidateName}</strong>.
            </span>
          </div>
        )}
        {!aiConfigured && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>AI key not set.</strong> The test runs in fallback mode (a small
            static test + placeholder score) so you can see the flow. Set{" "}
            <code className="text-xs">ANTHROPIC_API_KEY</code> for live AI-generated
            items and real CEFR writing assessment.
          </div>
        )}
        <p className="mb-6 text-xs text-muted-foreground">
          Indicative placement, not a certified high-stakes score. Four skills (Reading,
          Listening, Writing, Speaking), a downloadable CEFR certificate, cohort reporting,
          and an emailed result are built in.
        </p>
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
