import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";

/** Vrai tant qu’aucun super administrateur n’existe (première utilisation). */
export async function needsInstallation() {
  if (!hasServiceKey()) return false;
  try {
    const admin = createAdminClient();
    const { count, error } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "super_admin");
    if (error) return false;
    return (count ?? 0) === 0;
  } catch {
    return false;
  }
}
