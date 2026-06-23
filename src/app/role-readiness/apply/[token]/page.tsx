import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";
import { ApplyFlow } from "./_components/apply-flow";

export const dynamic = "force-dynamic";

export const metadata = { title: "Role Readiness Assessment · VIFM" };

export default async function RoleReadinessApplyPage({ params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-[#010131]">Invalid or expired link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This assessment link is not valid. Please check with the organisation that invited you.
        </p>
      </div>
    );
  }

  const completed = ctx.sections.filter((s) => s.completed_at != null).map((s) => s.section);

  return (
    <ApplyFlow
      token={params.token}
      candidateName={ctx.candidate.full_name}
      roleName={ctx.config.name_en}
      hasConsent={!!ctx.candidate.consent_at}
      hasTechnical={ctx.config.technicalAreas.length > 0}
      completedSections={completed}
      initialVerdict={ctx.candidate.verdict}
    />
  );
}
