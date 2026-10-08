"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { CARNET_FIELDS } from "@/lib/labels";
import type { ActionResult, PropertySecretsRow } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function propertyPayload(fd: FormData) {
  const payload: Record<string, unknown> = {
    name: str(fd, "name"),
    address: str(fd, "address") || null,
    postal_code: str(fd, "postal_code") || null,
    commune: str(fd, "commune") || null,
    is_active: fd.has("is_active") ? fd.get("is_active") === "on" : true,
  };
  for (const f of CARNET_FIELDS) {
    if (fd.has(f.key)) payload[f.key] = str(fd, f.key) || null;
  }
  return payload;
}

function revalidateProperty(id: string) {
  revalidatePath("/admin/proprietes");
  revalidatePath(`/admin/proprietes/${id}`);
  revalidatePath("/admin");
  revalidatePath("/client", "layout");
}

export async function createProperty(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const payload = propertyPayload(formData);
  if (!payload.name) return { error: "Le nom de la propriété est obligatoire." };
  const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
  if (error) return { error: error.message };
  const clientId = str(formData, "client_id");
  if (clientId) await supabase.from("property_owners").insert({ property_id: data.id, client_id: clientId, is_primary: true });
  const planId = str(formData, "plan_id");
  if (planId) {
    const started = str(formData, "started_on") || new Date().toISOString().slice(0, 10);
    const renewal = new Date(started + "T12:00:00Z");
    renewal.setUTCFullYear(renewal.getUTCFullYear() + 1);
    await supabase.from("subscriptions").insert({ property_id: data.id, plan_id: planId, started_on: started, renewal_on: renewal.toISOString().slice(0, 10) });
  }
  revalidateProperty(data.id);
  redirect(`/admin/proprietes/${data.id}`);
}

export async function updateProperty(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "property_id");
  const payload = propertyPayload(formData);
  if (!id || !payload.name) return { error: "Le nom de la propriété est obligatoire." };
  const { error } = await supabase.from("properties").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidateProperty(id);
  return { ok: true, message: "Propriété enregistrée." };
}

export async function updateCarnet(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "property_id");
  const payload: Record<string, unknown> = {};
  for (const f of CARNET_FIELDS) payload[f.key] = str(formData, f.key) || null;
  const { error } = await supabase.from("properties").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidateProperty(id);
  return { ok: true, message: "Carnet Maison enregistré." };
}

export async function setCoverPhoto(propertyId: string, storagePath: string | null): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("properties").update({ cover_photo_path: storagePath }).eq("id", propertyId);
  if (error) return { error: error.message };
  revalidateProperty(propertyId);
  return { ok: true };
}

export async function addOwner(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const property_id = str(formData, "property_id");
  const client_id = str(formData, "client_id");
  if (!property_id || !client_id) return { error: "Choisissez un client." };
  const { count } = await supabase.from("property_owners").select("client_id", { count: "exact", head: true }).eq("property_id", property_id);
  const { error } = await supabase.from("property_owners").insert({ property_id, client_id, is_primary: (count ?? 0) === 0 });
  if (error) return { error: error.code === "23505" ? "Ce client est déjà propriétaire de cette maison." : error.message };
  revalidateProperty(property_id);
  revalidatePath(`/admin/clients/${client_id}`);
  return { ok: true };
}

export async function removeOwner(propertyId: string, clientId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("property_owners").delete().match({ property_id: propertyId, client_id: clientId });
  if (error) return { error: error.message };
  revalidateProperty(propertyId);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function saveSubscription(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const property_id = str(formData, "property_id");
  const plan_id = str(formData, "plan_id");
  const status = str(formData, "status") || "actif";
  if (!property_id || !plan_id) return { error: "Choisissez une formule." };
  const overrideVisits = str(formData, "visits_per_year_override");
  const overridePrice = str(formData, "monthly_price_override").replace(",", ".");
  const payload = {
    plan_id,
    status,
    started_on: str(formData, "started_on") || new Date().toISOString().slice(0, 10),
    renewal_on: str(formData, "renewal_on") || null,
    visits_per_year_override: overrideVisits ? Number(overrideVisits) : null,
    monthly_price_override: overridePrice ? Number(overridePrice) : null,
  };
  const existingId = str(formData, "subscription_id");
  let error;
  if (existingId) {
    ({ error } = await supabase.from("subscriptions").update(payload).eq("id", existingId));
  } else {
    // Une seule formule active par maison : on clôt l’éventuelle formule active.
    if (status === "actif") await supabase.from("subscriptions").update({ status: "resilie" }).eq("property_id", property_id).eq("status", "actif");
    ({ error } = await supabase.from("subscriptions").insert({ property_id, ...payload }));
  }
  if (error) return { error: error.message };
  revalidateProperty(property_id);
  return { ok: true, message: "Abonnement enregistré." };
}

export async function addPropertyNote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  const property_id = str(formData, "property_id");
  const body = str(formData, "body");
  if (!property_id || !body) return { error: "La note est vide." };
  const { error } = await supabase.from("property_notes").insert({ property_id, body, visibility: str(formData, "visibility") === "client" ? "client" : "interne", author_id: user.id });
  if (error) return { error: error.message };
  revalidateProperty(property_id);
  return { ok: true };
}

export async function deletePropertyNote(noteId: string, propertyId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("property_notes").delete().eq("id", noteId);
  if (error) return { error: error.message };
  revalidateProperty(propertyId);
  return { ok: true };
}

/** Informations sensibles (clés, codes) : super_admin et intendant uniquement, consultation journalisée. */
export async function getSecrets(propertyId: string): Promise<{ data?: PropertySecretsRow; error?: string }> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("get_property_secrets", { p_property_id: propertyId });
  if (error) return { error: error.message.includes("refusé") ? "Accès réservé au super administrateur et aux intendants." : error.message };
  return { data: (data as PropertySecretsRow) ?? { property_id: propertyId, key_location: null, key_label: null, alarm_code: null, gate_code: null, access_notes: null } };
}

export async function saveSecrets(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const property_id = str(formData, "property_id");
  const { error } = await supabase.rpc("set_property_secrets", {
    p_property_id: property_id,
    p_key_location: str(formData, "key_location") || null,
    p_key_label: str(formData, "key_label") || null,
    p_alarm_code: str(formData, "alarm_code") || null,
    p_gate_code: str(formData, "gate_code") || null,
    p_access_notes: str(formData, "access_notes") || null,
  });
  if (error) return { error: error.message.includes("refusé") ? "Accès réservé au super administrateur et aux intendants." : error.message };
  return { ok: true, message: "Informations sensibles enregistrées (modification journalisée)." };
}

/** Checklist personnalisée : copie du modèle général pour cette maison. */
export async function createPropertyChecklist(propertyId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: existing } = await supabase.from("checklist_templates").select("id").eq("property_id", propertyId).maybeSingle();
  if (existing) return { ok: true };
  const { data: property } = await supabase.from("properties").select("name").eq("id", propertyId).single();
  const { data: tpl, error } = await supabase.from("checklist_templates").insert({ name: `Checklist ${property?.name ?? ""}`.trim(), property_id: propertyId }).select("id").single();
  if (error) return { error: error.message };
  const { data: def } = await supabase.from("checklist_templates").select("id").eq("is_default", true).maybeSingle();
  if (def) {
    const { data: items } = await supabase.from("checklist_template_items").select("category, label, kind, unit, position").eq("template_id", def.id);
    if (items?.length) await supabase.from("checklist_template_items").insert(items.map((i) => ({ ...i, template_id: tpl.id })));
  }
  revalidatePath(`/admin/proprietes/${propertyId}/checklist`);
  return { ok: true };
}

export async function deletePropertyChecklist(propertyId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("checklist_templates").delete().eq("property_id", propertyId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/proprietes/${propertyId}/checklist`);
  return { ok: true };
}

export async function addTemplateItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const template_id = str(formData, "template_id");
  const category = str(formData, "category");
  const label = str(formData, "label");
  if (!template_id || !category || !label) return { error: "Catégorie et intitulé obligatoires." };
  const { data: last } = await supabase.from("checklist_template_items").select("position").eq("template_id", template_id).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("checklist_template_items").insert({
    template_id, category, label,
    kind: str(formData, "kind") === "number" ? "number" : "check",
    unit: str(formData, "unit") || null,
    position: (last?.position ?? 0) + 10,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteTemplateItem(itemId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("checklist_template_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function moveTemplateItem(itemId: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: item } = await supabase.from("checklist_template_items").select("id, template_id, position").eq("id", itemId).single();
  if (!item) return { error: "Introuvable." };
  const q = supabase.from("checklist_template_items").select("id, position").eq("template_id", item.template_id);
  const { data: neighbour } = direction === "up"
    ? await q.lt("position", item.position).order("position", { ascending: false }).limit(1).maybeSingle()
    : await q.gt("position", item.position).order("position", { ascending: true }).limit(1).maybeSingle();
  if (!neighbour) return { ok: true };
  await supabase.from("checklist_template_items").update({ position: neighbour.position }).eq("id", item.id);
  await supabase.from("checklist_template_items").update({ position: item.position }).eq("id", neighbour.id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
