import { redirect } from "next/navigation";
import { getSession, isStaffRole } from "@/lib/auth";

export default async function Home() {
  const { user, profile } = await getSession();
  if (!user) redirect("/connexion");
  redirect(isStaffRole(profile?.role) ? "/admin" : "/client");
}
