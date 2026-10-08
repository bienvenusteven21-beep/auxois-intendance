"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function payload(fd: FormData) {
  return {
    company: str(fd, "company"),
    trade: str(fd, "trade"),
    contact_name: str(fd, "contact_name") || null,
    phone: str(fd, "phone") || null,
    email: str(fd, "email") || null,
    zone: str(fd, "zone") || null,
    internal_notes: str(fd, "internal_notes") || null,
    is_active: fd.has("is_active") ? fd.get("is_active") === "on" : true,
  };
}

export async function createPartner(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const p = payload(formData);
  if (!p.company || !p.trade) return { error: "Entreprise et métier obligatoires." };
  const { data, error } = await supabase.from("partners").insert(p).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/partenaires");
  redirect(`/admin/partenaires/${data.id}`);
}

export async function updatePartner(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "partner_id");
  const p = payload(formData);
  if (!id || !p.company || !p.trade) return { error: "Entreprise et métier obligatoires." };
  const { error } = await supabase.from("partners").update(p).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/partenaires");
  revalidatePath(`/admin/partenaires/${id}`);
  return { ok: true, message: "Partenaire enregistré." };
}

export async function deletePartner(id: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/partenaires");
  redirect("/admin/partenaires");
}
