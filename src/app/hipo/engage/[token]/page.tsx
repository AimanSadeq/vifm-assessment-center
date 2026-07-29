import { findEngagementSurveyByToken } from "@/lib/hipo/engagement";
import { EngageForm } from "./_components/engage-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manager Survey · VIFM High-Potential Profile" };

/**
 * Token-gated manager engagement survey (no account). The unguessable token is
 * the sole credential; auth is bypassed in middleware for /hipo/engage/.
 */
export default async function HipoEngagePage({ params }: { params: { token: string } }) {
  const ctx = await findEngagementSurveyByToken(params.token);

  if (!ctx) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-[#010131]">This link is not valid</h1>
        <p className="mt-2 text-sm text-slate-600">
          The survey link may be incomplete or withdrawn. Please use the exact link from your invitation email, or
          contact the VIFM team who invited you.
        </p>
      </Shell>
    );
  }

  if (ctx.survey.completed_at) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-[#010131]">Thank you - already submitted</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your survey about {ctx.candidateName} was received. No further action is needed.
        </p>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <EngageForm token={params.token} managerName={ctx.survey.manager_name} candidateName={ctx.candidateName} />
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-[#FEFFF9] px-4 py-10">
      <div className={`mx-auto ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="mb-6 rounded-xl bg-[#010131] px-6 py-5 text-white">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5391D5]">VIFM Caliber®</div>
          <div className="mt-1 text-lg font-bold">High-Potential Profile · Manager Survey</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
