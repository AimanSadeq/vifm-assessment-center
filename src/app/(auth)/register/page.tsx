import { redirect } from "next/navigation";

// Caliber is a provision-only B2B platform: every account is created by an admin
// (scripts/create-admin.ts, provision-candidate / provision-client-manager, or the
// in-app "Invite to portal" button). There is NO self-service sign-up anywhere -
// no public auth.signUp path exists - so /register must not present a registration
// affordance. Redirect to /login rather than render a dead placeholder that invites
// prospects to "create an account" that they cannot.
export default function RegisterPage() {
  redirect("/login");
}
