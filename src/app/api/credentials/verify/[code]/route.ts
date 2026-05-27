/**
 * Public credential verification endpoint. No auth (middleware bypasses
 * /api/credentials/verify/*). Returns only non-sensitive fields via the
 * service-role reader. Usable by external verifiers programmatically.
 */
import { NextResponse } from "next/server";
import { getCredentialForVerification } from "@/lib/credentials/issue";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const credential = await getCredentialForVerification(params.code);
  if (!credential) {
    return NextResponse.json({ verified: false, reason: "not_found" }, { status: 404 });
  }
  const revoked = !!credential.revokedAt;
  const expired = credential.expiresAt ? new Date(credential.expiresAt) < new Date() : false;
  return NextResponse.json({
    verified: !revoked && !expired,
    revoked,
    expired,
    credential,
  });
}
