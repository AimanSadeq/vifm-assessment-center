import Link from "next/link";
import { ArrowLeft, Languages } from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { FluentClient } from "./_components/fluent-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VIFM Fluent · English placement (prototype)",
};

export default function FluentPage() {
  const aiConfigured = isAIConfigured();

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
            A bilingual English placement test. <strong>Reading</strong> items are
            AI-generated and auto-scored; the <strong>Writing</strong> task is scored
            live by Claude against the CEFR criteria — the part IELTS/TOEFL pay human
            examiners for. You get an indicative CEFR level (A1–C2) with feedback in
            minutes. Navigate and read feedback in English or Arabic.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {!aiConfigured && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>AI key not set.</strong> The test runs in fallback mode (a small
            static test + placeholder score) so you can see the flow. Set{" "}
            <code className="text-xs">ANTHROPIC_API_KEY</code> for live AI-generated
            items and real CEFR writing assessment.
          </div>
        )}
        <p className="mb-6 text-xs text-muted-foreground">
          Indicative placement, not a certified high-stakes score. Listening, Speaking
          (via Whisper), persistence, cohort reporting and certificates are planned
          follow-ons.
        </p>
        <FluentClient />
      </main>
    </div>
  );
}
