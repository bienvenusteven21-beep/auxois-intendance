"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/origin";
import { DEMO_CLIENT_IDS, DEMO_FILES, DEMO_PROPERTY_IDS } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

async function findUserIdByEmail(email: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
  return data?.id as string | undefined;
}

export async function isDemoInstalled() {
  const admin = createAdminClient();
  const { data } = await admin.from("properties").select("id").eq("id", DEMO_PROPERTY_IDS.semur).maybeSingle();
  return Boolean(data);
}

/** Étape 2 de l’installation / Paramètres : installe la démonstration. */
export async function installDemo(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  if (await isDemoInstalled()) return { error: "Les données de démonstration sont déjà installées." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  if (!email || password.length < 8) return { error: "Indiquez un email et un mot de passe (8 caractères minimum) pour le compte de démonstration." };

  // 1. Compte de connexion du client de démonstration (Jean Martin)
  let clientUserId = await findUserIdByEmail(email);
  if (!clientUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Jean Martin" },
    });
    if (error) return { error: `Création du compte de démonstration impossible : ${error.message}` };
    clientUserId = data.user.id;
  } else {
    const { data: existing } = await admin.from("users").select("role").eq("id", clientUserId).maybeSingle();
    if (existing?.role !== "client") return { error: "Cette adresse appartient déjà à un membre de l’équipe : choisissez-en une autre." };
    await admin.auth.admin.updateUserById(clientUserId, { password });
  }

  // 2. Données
  const { error: seedError } = await admin.rpc("seed_demo", { p_admin_id: user.id, p_client_user_id: clientUserId });
  if (seedError) return { error: `Installation des données impossible : ${seedError.message}` };

  // 3. Fichiers (photos et documents de démonstration)
  const origin = await getOrigin();
  const failures: string[] = [];
  for (const f of DEMO_FILES) {
    try {
      let bytes: Uint8Array | null = null;
      try {
        bytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "demo", f.file)));
      } catch {
        const res = await fetch(`${origin}/demo/${f.file}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        bytes = new Uint8Array(await res.arrayBuffer());
      }
      const { error } = await admin.storage
        .from(f.bucket)
        .upload(`${f.property}/${f.file}`, bytes, { contentType: f.mime, upsert: true });
      if (error) throw error;
    } catch (e) {
      failures.push(`${f.file} (${(e as Error).message})`);
    }
  }

  revalidatePath("/", "layout");
  if (failures.length) {
    return {
      ok: true,
      message: `Démonstration installée. Certains fichiers n’ont pas pu être téléversés : ${failures.join(", ")}.`,
    };
  }
  redirect("/admin?bienvenue=1");
}

/** Supprime toutes les données et fichiers de démonstration. */
export async function removeDemo(): Promise<ActionResult> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: demoClients } = await admin.from("clients").select("user_id").in("id", DEMO_CLIENT_IDS);

  for (const bucket of ["photos", "documents"] as const) {
    for (const propertyId of Object.values(DEMO_PROPERTY_IDS)) {
      const { data: objects } = await admin.storage.from(bucket).list(propertyId, { limit: 1000 });
      if (objects?.length) {
        await admin.storage.from(bucket).remove(objects.map((o) => `${propertyId}/${o.name}`));
      }
    }
  }

  const { error } = await admin.rpc("remove_demo");
  if (error) return { error: error.message };

  for (const c of demoClients ?? []) {
    if (c.user_id) await admin.auth.admin.deleteUser(c.user_id);
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Les données de démonstration ont été supprimées." };
}
