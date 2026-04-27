import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's role and redirect to the appropriate portal
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  switch (profile?.role) {
    case "admin":
      redirect("/admin");
    case "lead_assessor":
    case "associate_assessor":
      redirect("/assessor");
    case "candidate":
      redirect("/candidate");
    case "client":
      redirect("/client");
    default:
      redirect("/login");
  }
}
