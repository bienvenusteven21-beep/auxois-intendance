"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/origin";
import { getSession, isStaffRole } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function translateAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Merci de confirmer votre adresse email (regardez votre boîte de réception).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cette adresse.";
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (m.includes("rate limit")) return "Trop de tentatives. Merci de patienter quelques minutes.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Adresse email invalide.";
  return message;
}

export async function signIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const next = str(formData, "next");
  if (!email || !password) return { error: "Merci de saisir votre email et votre mot de passe." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message) };

  const { profile } = await getSession();
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(safeNext ?? (isStaffRole(profile?.role) ? "/admin" : "/client"));
}

export async function signUp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const consent = formData.get("consent") === "on";
  if (!fullName) return { error: "Merci d’indiquer votre nom." };
  if (!email || !password) return { error: "Merci de saisir un email et un mot de passe." };
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (!consent) return { error: "Merci d’accepter la politique de confidentialité." };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: translateAuthError(error.message) };

  if (data.session) {
    await recordConsent();
    redirect("/");
  }
  return {
    ok: true,
    message: "Votre compte est créé. Vérifiez votre boîte email pour confirmer votre adresse, puis connectez-vous.",
  };
}

export async function recordConsent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: settings } = await supabase.from("settings").select("privacy_policy_version").maybeSingle();
  await supabase
    .from("consents")
    .upsert({ user_id: user.id, policy_version: settings?.privacy_policy_version ?? "2026-10" }, { onConflict: "user_id,policy_version", ignoreDuplicates: true });
}

export async function acceptPolicy(): Promise<ActionResult> {
  await recordConsent();
  revalidatePath("/client");
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

export async function forgotPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = str(formData, "email").toLowerCase();
  if (!email) return { error: "Merci de saisir votre adresse email." };
  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reinitialiser-mot-de-passe`,
  });
  if (error) return { error: translateAuthError(error.message) };
  return { ok: true, message: "Si un compte existe avec cette adresse, un email vient de vous être envoyé." };
}

export async function updatePassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const password = str(formData, "password");
  const confirm = str(formData, "confirm");
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (password !== confirm) return { error: "Les deux mots de passe ne sont pas identiques." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };
  return { ok: true, message: "Votre mot de passe a été mis à jour." };
}

export async function updateProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non connecté." };
  const full_name = str(formData, "full_name");
  const phone = str(formData, "phone") || null;
  const language = str(formData, "language") || "fr";
  const { error } = await supabase.from("users").update({ full_name, phone, language }).eq("id", user.id);
  if (error) return { error: error.message };
  // Synchronise la fiche client si elle existe
  await supabase.from("clients").update({ phone }).eq("user_id", user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profil enregistré." };
}

/** Assistant d’installation : étape 1, création du premier compte (super_admin). */
export async function installFirstAdmin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!hasServiceKey()) return { error: "La clé de service Supabase (SUPABASE_SERVICE_ROLE_KEY) n’est pas configurée." };
  const secret = process.env.SETUP_SECRET;
  if (secret && str(formData, "setup_secret") !== secret) return { error: "Code d’installation incorrect." };

  const admin = createAdminClient();
  const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "super_admin");
  if ((count ?? 0) > 0) return { error: "Un administrateur existe déjà. Connectez-vous." };

  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  if (!fullName || !email || password.length < 8) return { error: "Merci de remplir tous les champs (mot de passe : 8 caractères minimum)." };

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: translateAuthError(error.message) };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: translateAuthError(signInError.message) };
  await recordConsent();
  redirect("/installation?etape=2");
}
