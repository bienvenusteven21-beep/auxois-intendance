"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { parisToIso } from "@/lib/format";
import { scheduleDelivery } from "@/lib/notifications/trigger";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function revalidate(id: string) {
  revalidatePath("/admin/demandes");
  revalidatePath(`/admin/demandes/${id}`);
  revalidatePath("/admin/planning");
  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
}

export async function updateRequest(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "request_id");
  if (!id) return { error: "Demande introuvable." };
  const p: Record<string, unknown> = {};
  if (formData.has("status")) p.status = str(formData, "status");
  if (formData.has("reply")) p.reply = str(formData, "reply") || null;
  if (formData.has("date")) p.planned_for = str(formData, "date") ? parisToIso(str(formData, "date"), str(formData, "time") || "09:00") : null;
  const { error } = await supabase.from("client_requests").update(p).eq("id", id);
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidate(id);
  return { ok: true, message: "Demande mise à jour." };
}

export async function setRequestStatus(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("client_requests").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidate(id);
  return { ok: true };
}

/** Marque une demande « vue » à l’ouverture (appelée pendant le rendu : pas de revalidation ici). */
export async function markRequestSeen(id: string) {
  const { supabase } = await requireStaff();
  await supabase.from("client_requests").update({ status: "vue" }).eq("id", id).eq("status", "nouvelle");
}

export async function updateStayStatus(stayId: string, status: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("stays").update({ status }).eq("id", stayId);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true };
}

/** Création d’une demande par l’équipe (ex. reçue par téléphone). */
export async function createRequestAsStaff(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  const property_id = str(formData, "property_id");
  const subject = str(formData, "subject");
  if (!property_id || !subject) return { error: "Propriété et objet obligatoires." };
  const { data: owner } = await supabase.from("property_owners").select("client_id").eq("property_id", property_id).order("is_primary", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("client_requests").insert({
    property_id, client_id: owner?.client_id ?? null, created_by: user.id, kind: "general", subject, message: str(formData, "message") || null, status: "vue",
  });
  if (error) return { error: error.message };
  revalidate("");
  return { ok: true, message: "Demande enregistrée." };
}
