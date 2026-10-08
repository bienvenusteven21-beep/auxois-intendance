"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function clientPayload(fd: FormData) {
  return {
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    phone: str(fd, "phone") || null,
    email: str(fd, "email").toLowerCase() || null,
    main_address: str(fd, "main_address") || null,
    preferred_language: str(fd, "preferred_language") || "fr",
    is_active: fd.has("is_active") ? fd.get("is_active") === "on" : true,
  };
}

export async function createClientSheet(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const payload = clientPayload(formData);
  if (!payload.first_name || !payload.last_name) return { error: "Prénom et nom sont obligatoires." };
  const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
  if (error) return { error: error.message };
  const notes = str(formData, "notes");
  if (notes) await supabase.from("client_internal_notes").upsert({ client_id: data.id, notes });
  // Si un compte existe déjà avec cet email, on le relie automatiquement.
  if (payload.email) await linkByEmail(data.id, payload.email);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${data.id}`);
}

export async function updateClientSheet(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "client_id");
  const payload = clientPayload(formData);
  if (!id || !payload.first_name || !payload.last_name) return { error: "Prénom et nom sont obligatoires." };
  const { error } = await supabase.from("clients").update(payload).eq("id", id);
  if (error) return { error: error.message };
  await supabase.from("client_internal_notes").upsert({ client_id: id, notes: str(formData, "notes") });
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/client", "layout");
  return { ok: true, message: "Fiche client enregistrée." };
}

async function linkByEmail(clientId: string, email: string) {
  if (!hasServiceKey()) return false;
  const admin = createAdminClient();
  const { data: u } = await admin.from("users").select("id, role").eq("email", email).maybeSingle();
  if (!u || u.role !== "client") return false;
  const { data: taken } = await admin.from("clients").select("id").eq("user_id", u.id).maybeSingle();
  if (taken && taken.id !== clientId) return false;
  await admin.from("clients").update({ user_id: u.id }).eq("id", clientId);
  return true;
}

function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Crée (ou relie) le compte de connexion d’un propriétaire.
 * Retourne un mot de passe provisoire à lui communiquer.
 */
export async function createClientAccess(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!hasServiceKey()) return { error: "La clé de service Supabase n’est pas configurée : impossible de créer un accès." };
  const admin = createAdminClient();
  const clientId = str(formData, "client_id");
  const email = str(formData, "email").toLowerCase();
  if (!clientId || !email) return { error: "Adresse email obligatoire." };

  const { data: client } = await admin.from("clients").select("id, user_id, first_name, last_name").eq("id", clientId).maybeSingle();
  if (!client) return { error: "Fiche client introuvable." };
  if (client.user_id) return { error: "Ce client a déjà un accès." };

  if (await linkByEmail(clientId, email)) {
    await admin.from("clients").update({ email }).eq("id", clientId);
    revalidatePath(`/admin/clients/${clientId}`);
    return { ok: true, message: "Un compte existait déjà avec cette adresse : il est maintenant relié à cette fiche. Le client peut se connecter avec son mot de passe habituel." };
  }

  const password = generatePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${client.first_name} ${client.last_name}`.trim() },
  });
  if (error) {
    if (/already/i.test(error.message)) return { error: "Un compte existe déjà avec cette adresse mais il appartient à un membre de l’équipe ou à une autre fiche." };
    return { error: error.message };
  }
  await admin.from("users").update({ phone: str(formData, "phone") || null }).eq("id", data.user.id);
  const { error: linkError } = await admin.from("clients").update({ user_id: data.user.id, email }).eq("id", clientId);
  if (linkError) return { error: linkError.message };

  revalidatePath(`/admin/clients/${clientId}`);
  return {
    ok: true,
    message: `Accès créé. Identifiant : ${email} — mot de passe provisoire : ${password} . Communiquez-le au client ; il pourra le changer depuis son profil.`,
  };
}

export async function resetClientPassword(clientId: string): Promise<ActionResult> {
  await requireStaff();
  if (!hasServiceKey()) return { error: "Clé de service non configurée." };
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("user_id").eq("id", clientId).maybeSingle();
  if (!client?.user_id) return { error: "Ce client n’a pas d’accès." };
  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(client.user_id, { password });
  if (error) return { error: error.message };
  return { ok: true, message: `Nouveau mot de passe provisoire : ${password}` };
}

export async function unlinkClientAccess(clientId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("clients").update({ user_id: null }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: "Accès retiré : ce compte ne voit plus aucune propriété." };
}
