"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { parisToIso } from "@/lib/format";
import { scheduleDelivery } from "@/lib/notifications/trigger";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function revalidate(id: string, propertyId?: string) {
  revalidatePath("/admin/interventions");
  revalidatePath(`/admin/interventions/${id}`);
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  if (propertyId) revalidatePath(`/admin/proprietes/${propertyId}`);
  revalidatePath("/client", "layout");
}

function payload(fd: FormData) {
  const p: Record<string, unknown> = {};
  if (fd.has("title")) p.title = str(fd, "title");
  if (fd.has("description")) p.description = str(fd, "description") || null;
  if (fd.has("partner_id")) p.partner_id = str(fd, "partner_id") || null;
  if (fd.has("status")) p.status = str(fd, "status");
  if (fd.has("report")) p.report = str(fd, "report") || null;
  if (fd.has("final_cost")) {
    const c = str(fd, "final_cost").replace(",", ".");
    p.final_cost = c ? Number(c) : null;
  }
  if (fd.has("date")) p.scheduled_at = str(fd, "date") ? parisToIso(str(fd, "date"), str(fd, "time") || "09:00") : null;
  return p;
}

export async function createIntervention(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const property_id = str(formData, "property_id");
  const p = payload(formData);
  if (!property_id || !p.title) return { error: "Propriété et intitulé obligatoires." };
  const { data, error } = await supabase
    .from("interventions")
    .insert({ property_id, observation_id: str(formData, "observation_id") || null, ...p })
    .select("id")
    .single();
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidate(data.id, property_id);
  redirect(`/admin/interventions/${data.id}`);
}

export async function updateIntervention(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "intervention_id");
  const p = payload(formData);
  if (!id) return { error: "Intervention introuvable." };
  if (p.title === "") return { error: "L’intitulé est obligatoire." };
  const { data, error } = await supabase.from("interventions").update(p).eq("id", id).select("property_id").single();
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidate(id, data.property_id);
  return { ok: true, message: "Intervention enregistrée." };
}

export async function setInterventionStatus(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from("interventions").update({ status }).eq("id", id).select("property_id").single();
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidate(id, data.property_id);
  return { ok: true };
}
