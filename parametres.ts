"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, requireSuperAdmin } from "@/lib/auth";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";
import { parisToIso } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function updateSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase
    .from("settings")
    .update({
      company_name: str(formData, "company_name") || "Auxois Intendance",
      tagline: str(formData, "tagline") || "Votre maison, suivie toute l’année.",
      phone: str(formData, "phone") || null,
      email: str(formData, "email") || null,
      address: str(formData, "address") || null,
      privacy_policy_version: str(formData, "privacy_policy_version") || "2026-10",
    })
    .eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Coordonnées enregistrées." };
}

export async function setLogo(storagePath: string | null): Promise<ActionResult> {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("settings").update({ logo_path: storagePath }).eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateUserRole(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireSuperAdmin();
  const id = str(formData, "user_id");
  const role = str(formData, "role");
  const is_active = formData.get("is_active") === "on";
  const { error } = await supabase.from("users").update({ role, is_active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/parametres/utilisateurs");
  return { ok: true, message: "Utilisateur mis à jour." };
}

/** Invite un membre de l’équipe (crée son compte avec un mot de passe provisoire). */
export async function inviteTeamMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireSuperAdmin();
  if (!hasServiceKey()) return { error: "Clé de service non configurée." };
  const admin = createAdminClient();
  const email = str(formData, "email").toLowerCase();
  const full_name = str(formData, "full_name");
  const role = str(formData, "role") || "intendant";
  if (!email || !full_name) return { error: "Nom et email obligatoires." };
  if (!["super_admin", "intendant", "assistant"].includes(role)) return { error: "Rôle invalide." };
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const password = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => alphabet[b % alphabet.length]).join("");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error) return { error: /already/i.test(error.message) ? "Un compte existe déjà avec cette adresse : modifiez son rôle dans la liste." : error.message };
  const { error: roleError } = await supabase.from("users").update({ role }).eq("id", data.user.id);
  if (roleError) return { error: roleError.message };
  revalidatePath("/admin/parametres/utilisateurs");
  return { ok: true, message: `Compte créé. Identifiant : ${email} — mot de passe provisoire : ${password}` };
}

export async function savePlan(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireSuperAdmin();
  const id = str(formData, "plan_id");
  const payload = {
    name: str(formData, "name"),
    code: str(formData, "code").toLowerCase().replace(/[^a-z0-9_-]/g, "") || str(formData, "name").toLowerCase().replace(/[^a-z0-9]/g, "_"),
    monthly_price: Number(str(formData, "monthly_price").replace(",", ".") || 0),
    visits_per_year: Number(str(formData, "visits_per_year") || 12),
    included_services: str(formData, "included_services").split("\n").map((s) => s.trim()).filter(Boolean),
    position: Number(str(formData, "position") || 0),
    is_active: formData.get("is_active") === "on",
  };
  if (!payload.name) return { error: "Le nom est obligatoire." };
  const { error } = id ? await supabase.from("subscription_plans").update(payload).eq("id", id) : await supabase.from("subscription_plans").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/parametres/formules");
  revalidatePath("/client", "layout");
  return { ok: true, message: "Formule enregistrée." };
}

export async function saveNotificationTemplate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireSuperAdmin();
  const key = str(formData, "key");
  const { error } = await supabase
    .from("notification_templates")
    .update({
      title: str(formData, "title"),
      body: str(formData, "body"),
      send_push: formData.get("send_push") === "on",
      send_email: formData.get("send_email") === "on",
      is_enabled: formData.get("is_enabled") === "on",
    })
    .eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/admin/parametres/notifications");
  return { ok: true, message: "Modèle enregistré." };
}

export async function saveDocumentCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "category_id");
  const name = str(formData, "name");
  if (!name) return { error: "Le nom est obligatoire." };
  const position = Number(str(formData, "position") || 0);
  const { error } = id ? await supabase.from("document_categories").update({ name, position }).eq("id", id) : await supabase.from("document_categories").insert({ name, position });
  if (error) return { error: error.code === "23505" ? "Cette catégorie existe déjà." : error.message };
  revalidatePath("/admin/parametres/categories");
  return { ok: true };
}

export async function deleteDocumentCategory(id: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("document_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/parametres/categories");
  return { ok: true };
}

export async function saveInternalTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  const title = str(formData, "title");
  const due_at = parisToIso(str(formData, "date"), str(formData, "time") || "09:00");
  if (!title || !due_at) return { error: "Titre et date obligatoires." };
  const { error } = await supabase.from("internal_tasks").insert({
    title, due_at, notes: str(formData, "notes") || null, property_id: str(formData, "property_id") || null, assigned_to: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/planning");
  return { ok: true, message: "Tâche ajoutée au planning." };
}

export async function toggleInternalTask(id: string, done: boolean): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("internal_tasks").update({ is_done: done }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/planning");
  return { ok: true };
}

export async function deleteInternalTask(id: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("internal_tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/planning");
  return { ok: true };
}

export async function setDataRequestStatus(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("data_requests").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/parametres/rgpd");
  return { ok: true };
}

/** Supprime définitivement le compte d’un propriétaire (demande RGPD). */
export async function deleteClientAccount(userId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!hasServiceKey()) return { error: "Clé de service non configurée." };
  const admin = createAdminClient();
  const { data: u } = await admin.from("users").select("role").eq("id", userId).maybeSingle();
  if (!u) return { error: "Compte introuvable." };
  if (u.role !== "client") return { error: "Seul un compte propriétaire peut être supprimé ici." };
  await admin.from("clients").update({ user_id: null }).eq("user_id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Compte supprimé." };
}
