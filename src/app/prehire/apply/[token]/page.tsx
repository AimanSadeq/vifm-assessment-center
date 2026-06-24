import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { ApplyFlow } from "./_components/apply-flow";

export const dynamic = "force-dynamic";

export default async function PreHireApplyPage({ params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
        <div className="max-w-md text-center space-y-3">
          <VifmLogo variant="color" size="md" className="mx-auto" />
          <h1 className="text-xl font-semibold text-[#010131]">This link isn&apos;t valid</h1>
          <p className="text-sm text-muted-foreground">
            Please check the invitation link you were sent, or contact the hiring team.
          </p>
        </div>
      </div>
    );
  }

  return <ApplyFlow token={params.token} ctx={ctx} demo={ctx.requisition.is_demo} />;
}
