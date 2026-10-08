import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow, PropertyRow, Role, SettingsRow, UserRow } from "@/lib/types";

export const STAFF_ROLES: Role[] = ["super_admin", "intendant", "assistant"];

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserRow>();
  return { supabase, user, profile: profile ?? null };
});

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").maybeSingle<SettingsRow>();
  return (
    data ?? {
      id: true,
      company_name: "Auxois Intendance",
      tagline: "Votre maison, suivie toute l’année.",
      phone: null,
      email: null,
      address: null,
      logo_path: null,
      privacy_policy_version: "2026-10",
    }
  );
});

export async function requireUser() {
  const session = await getSession();
  if (!session.user || !session.profile) redirect("/connexion");
  return { supabase: session.supabase, user: session.user, profile: session.profile };
}

export async function requireStaff() {
  const s = await requireUser();
  if (!STAFF_ROLES.includes(s.profile.role) || !s.profile.is_active) redirect("/client");
  return s;
}

export async function requireSuperAdmin() {
  const s = await requireStaff();
  if (s.profile.role !== "super_admin") redirect("/admin");
  return s;
}

export function isStaffRole(role: Role | null | undefined) {
  return !!role && STAFF_ROLES.includes(role);
}

/** Espace propriétaire : fiche client liée + propriétés. */
export const requireClient = cache(async () => {
  const s = await requireUser();
  if (STAFF_ROLES.includes(s.profile.role)) redirect("/admin");
  const { data: client } = await s.supabase
    .from("clients")
    .select("*")
    .eq("user_id", s.user.id)
    .maybeSingle<ClientRow>();
  let properties: PropertyRow[] = [];
  if (client) {
    const { data: owned } = await s.supabase
      .from("property_owners")
      .select("property_id, is_primary, properties(*)")
      .eq("client_id", client.id);
    properties = (owned ?? [])
      .map((o) => o.properties as unknown as PropertyRow)
      .filter((p): p is PropertyRow => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
  return { ...s, client, properties };
});
