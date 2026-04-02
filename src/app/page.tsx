import { redirect } from "next/navigation";

export default function Home() {
  // TODO: Redirect based on user role once auth is configured
  redirect("/login");
}
