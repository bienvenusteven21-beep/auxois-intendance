"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { parisToIso } from "@/lib/format";
import { scheduleDelivery } from "@/lib/notifications/trigger";
import type { ActionResult, HouseStatus, ItemResult, ObservationLevel, VisitSummary } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(",", ".");
  return v === "" ? null : Number(v);
};

function revalidateVisit(visitId: string, propertyId?: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/visites");
  revalidatePath(`/admin/visites/${visitId}`);
  revalidatePath("/admin/planning");
  if (propertyId) revalidatePath(`/admin/proprietes/${propertyId}`);
  revalidatePath("/client", "layout");
}

/** Planifier une visite. */
export async function scheduleVisit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const property_id = str(formData, "property_id");
  const kind = str(formData, "kind") || "reguliere";
  const scheduled_at = parisToIso(str(formData, "date"), str(formData, "time") || "09:00");
  const stay_id = str(formData, "stay_id") || null;
  if (!property_id || !scheduled_at) return { error: "Merci de choisir une propriété et une date." };
  const { data, error } = await supabase
    .from("visits")
    .insert({ property_id, kind, scheduled_at, stay_id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidateVisit(data.id, property_id);
  const next = str(formData, "redirect");
  if (next) redirect(next);
  return { ok: true, message: "Visite planifiée." };
}

export async function rescheduleVisit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "visit_id");
  const scheduled_at = parisToIso(str(formData, "date"), str(formData, "time") || "09:00");
  const kind = str(formData, "kind");
  if (!id || !scheduled_at) return { error: "Date invalide." };
  const update: Record<string, unknown> = { scheduled_at };
  if (kind) update.kind = kind;
  const { data, error } = await supabase.from("visits").update(update).eq("id", id).select("property_id").single();
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidateVisit(id, data.property_id);
  return { ok: true, message: "Visite déplacée." };
}

export async function cancelVisit(visitId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase
    .from("visits")
    .update({ status: "annulee" })
    .eq("id", visitId)
    .in("status", ["planifiee"])
    .select("property_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Seule une visite planifiée peut être annulée." };
  revalidateVisit(visitId, data.property_id);
  return { ok: true };
}

/** DÉMARRER LA VISITE (ou reprendre une visite en cours). */
export async function startVisit(visitId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("start_visit", { p_visit_id: visitId });
  if (error) redirect(`/admin/visites/${visitId}?erreur=${encodeURIComponent(error.message)}`);
  revalidateVisit(visitId);
  redirect(`/admin/visites/${visitId}`);
}

/** Visite non planifiée : créée et démarrée immédiatement. */
export async function startUnplannedVisit(propertyId: string, kind: string = "controle"): Promise<void> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("start_unplanned_visit", { p_property_id: propertyId, p_kind: kind });
  if (error) redirect(`/admin/proprietes/${propertyId}?erreur=${encodeURIComponent(error.message)}`);
  revalidateVisit(data as string, propertyId);
  redirect(`/admin/visites/${data}`);
}

/** Coche / décoche un point de la checklist. */
export async function setChecklistItem(itemId: string, result: ItemResult | null, valueNumber?: number | null, note?: string | null): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const update: Record<string, unknown> = {
    result,
    checked_at: result ? new Date().toISOString() : null,
  };
  if (valueNumber !== undefined) update.value_number = valueNumber;
  if (note !== undefined) update.note = note;
  const { data, error } = await supabase.from("visit_checklist_items").update(update).eq("id", itemId).select("visit_id").single();
  if (error) return { error: error.message };
  revalidatePath(`/admin/visites/${data.visit_id}`);
  return { ok: true };
}

/** Enregistre une mesure (température, nombre de courriers) sur la visite. */
export async function setVisitMeasures(visitId: string, measures: { indoor_temperature?: number | null; mail_count?: number | null }): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("visits").update(measures).eq("id", visitId);
  if (error) return { error: error.message };
  return { ok: true };
}

/** Ajoute un point à la checklist de cette visite seulement. */
export async function addChecklistItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const visit_id = str(formData, "visit_id");
  const category = str(formData, "category");
  const label = str(formData, "label");
  if (!visit_id || !category || !label) return { error: "Catégorie et intitulé obligatoires." };
  const { data: last } = await supabase.from("visit_checklist_items").select("position").eq("visit_id", visit_id).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("visit_checklist_items").insert({
    visit_id, category, label, kind: str(formData, "kind") === "number" ? "number" : "check", unit: str(formData, "unit") || null,
    position: (last?.position ?? 0) + 10,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/visites/${visit_id}`);
  return { ok: true };
}

/** Enregistre une photo déjà téléversée dans le bucket « photos ». */
export async function addPhotoRecord(input: {
  property_id: string;
  storage_path: string;
  visit_id?: string | null;
  observation_id?: string | null;
  intervention_id?: string | null;
  phase?: "avant" | "apres" | null;
  category?: string | null;
  caption?: string | null;
  is_shared: boolean;
}): Promise<ActionResult & { id?: string }> {
  const { supabase, user } = await requireStaff();
  const { data, error } = await supabase
    .from("photos")
    .insert({ ...input, uploaded_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (input.visit_id) revalidatePath(`/admin/visites/${input.visit_id}`);
  if (input.intervention_id) revalidatePath(`/admin/interventions/${input.intervention_id}`);
  revalidatePath(`/admin/proprietes/${input.property_id}`);
  return { ok: true, id: data.id };
}

export async function updatePhoto(photoId: string, patch: { is_shared?: boolean; caption?: string | null; category?: string | null }): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from("photos").update(patch).eq("id", photoId).select("visit_id, intervention_id, property_id").single();
  if (error) return { error: error.message };
  if (data.visit_id) revalidatePath(`/admin/visites/${data.visit_id}`);
  if (data.intervention_id) revalidatePath(`/admin/interventions/${data.intervention_id}`);
  revalidatePath(`/admin/proprietes/${data.property_id}`);
  return { ok: true };
}

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: photo } = await supabase.from("photos").select("storage_path, visit_id, intervention_id, property_id").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo introuvable." };
  const { error } = await supabase.from("photos").delete().eq("id", photoId);
  if (error) return { error: error.message };
  await supabase.storage.from("photos").remove([photo.storage_path]);
  if (photo.visit_id) revalidatePath(`/admin/visites/${photo.visit_id}`);
  if (photo.intervention_id) revalidatePath(`/admin/interventions/${photo.intervention_id}`);
  revalidatePath(`/admin/proprietes/${photo.property_id}`);
  return { ok: true };
}

/** Crée une observation (pendant une visite ou depuis la fiche propriété). */
export async function createObservation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const property_id = str(formData, "property_id");
  const visit_id = str(formData, "visit_id") || null;
  const title = str(formData, "title");
  const level = (str(formData, "level") || "information") as ObservationLevel;
  if (!property_id || !title) return { error: "Merci de donner un titre à l’observation." };
  const { data, error } = await supabase
    .from("observations")
    .insert({
      property_id,
      visit_id,
      checklist_item_id: str(formData, "checklist_item_id") || null,
      title,
      description: str(formData, "description") || null,
      level,
      recommended_action: str(formData, "recommended_action") || null,
      estimate_min: num(formData, "estimate_min"),
      estimate_max: num(formData, "estimate_max"),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  // Les photos sélectionnées pendant la saisie sont rattachées à l’observation
  const photoIds = formData.getAll("photo_ids").map(String).filter(Boolean);
  if (photoIds.length) await supabase.from("photos").update({ observation_id: data.id }).in("id", photoIds);
  scheduleDelivery();
  if (visit_id) revalidatePath(`/admin/visites/${visit_id}`);
  revalidatePath(`/admin/proprietes/${property_id}`);
  revalidatePath("/admin");
  return { ok: true, message: "Observation enregistrée." };
}

export async function updateObservation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "observation_id");
  if (!id) return { error: "Observation introuvable." };
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "description", "recommended_action", "level", "status"]) {
    if (formData.has(k)) patch[k] = str(formData, k) || null;
  }
  if (formData.has("estimate_min")) patch.estimate_min = num(formData, "estimate_min");
  if (formData.has("estimate_max")) patch.estimate_max = num(formData, "estimate_max");
  if (formData.has("is_shared")) patch.is_shared = formData.get("is_shared") === "on";
  const { data, error } = await supabase.from("observations").update(patch).eq("id", id).select("visit_id, property_id").single();
  if (error) return { error: error.message };
  scheduleDelivery();
  if (data.visit_id) revalidatePath(`/admin/visites/${data.visit_id}`);
  revalidatePath(`/admin/proprietes/${data.property_id}`);
  revalidatePath(`/admin/observations/${id}`);
  revalidatePath("/admin");
  revalidatePath("/client", "layout");
  return { ok: true, message: "Observation mise à jour." };
}

export async function setObservationStatus(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from("observations").update({ status }).eq("id", id).select("visit_id, property_id").single();
  if (error) return { error: error.message };
  scheduleDelivery();
  if (data.visit_id) revalidatePath(`/admin/visites/${data.visit_id}`);
  revalidatePath(`/admin/proprietes/${data.property_id}`);
  revalidatePath(`/admin/observations/${id}`);
  revalidatePath("/client", "layout");
  return { ok: true };
}

export async function deleteObservation(id: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from("observations").delete().eq("id", id).select("visit_id, property_id").single();
  if (error) return { error: error.message };
  if (data.visit_id) revalidatePath(`/admin/visites/${data.visit_id}`);
  revalidatePath(`/admin/proprietes/${data.property_id}`);
  return { ok: true };
}

/** L’équipe enregistre une décision reçue par téléphone. */
export async function decideObservationAsStaff(id: string, decision: "autorise" | "contacter_avant" | "client_gere"): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("decide_observation", { p_observation_id: id, p_decision: decision, p_message: null });
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true };
}

/** TERMINER LA VISITE */
export async function finishVisit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const visitId = str(formData, "visit_id");
  const comment = str(formData, "comment");
  const status = (str(formData, "general_status") || "bon") as HouseStatus;
  if (!visitId) return { error: "Visite introuvable." };
  const measures: Record<string, unknown> = {};
  if (formData.has("indoor_temperature")) measures.indoor_temperature = num(formData, "indoor_temperature");
  if (formData.has("mail_count")) measures.mail_count = num(formData, "mail_count");
  if (Object.keys(measures).length) await supabase.from("visits").update(measures).eq("id", visitId);

  const { error } = await supabase.rpc("finish_visit", { p_visit_id: visitId, p_comment: comment, p_general_status: status });
  if (error) return { error: error.message };
  revalidateVisit(visitId);
  if (formData.get("send_debrief") === "on") {
    const { error: e2 } = await supabase.rpc("send_debrief", { p_visit_id: visitId });
    if (e2) return { error: `Visite terminée, mais le débrief n’a pas pu être envoyé : ${e2.message}` };
    scheduleDelivery();
  }
  redirect(`/admin/visites/${visitId}?terminee=1`);
}

/** ENVOYER LE DÉBRIEF AU PROPRIÉTAIRE */
export async function sendDebrief(visitId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("send_debrief", { p_visit_id: visitId });
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidateVisit(visitId);
  return { ok: true, message: "Débrief envoyé au propriétaire." };
}

export async function updateVisitComment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const visitId = str(formData, "visit_id");
  const { error } = await supabase
    .from("visits")
    .update({ intendant_comment: str(formData, "comment") || null, general_status: str(formData, "general_status") || null })
    .eq("id", visitId);
  if (error) return { error: error.message };
  revalidateVisit(visitId);
  return { ok: true, message: "Enregistré." };
}

export async function getVisitSummary(visitId: string): Promise<VisitSummary | null> {
  const { supabase } = await requireStaff();
  const { data } = await supabase.rpc("visit_summary", { p_visit_id: visitId });
  return (data as VisitSummary) ?? null;
}
