import Link from "next/link";
import { getSessionByToken, getPublicBlueprint } from "@/lib/technical-sandbox/service";
import { Runner } from "./_components/runner";

export const dynamic = "force-dynamic";

export default async function TechSandboxPage({ params }: { params: { token: string } }) {
  const session = await getSessionByToken(params.token);
  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Invalid or expired link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This assessment link is not valid. Please contact your administrator.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-[#5391D5] hover:underline">
          Home
        </Link>
      </div>
    );
  }
  const blueprint = await getPublicBlueprint(session.function_id);
  return <Runner token={params.token} blueprint={blueprint} initialStatus={session.status} />;
}
