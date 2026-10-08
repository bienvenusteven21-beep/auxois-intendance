"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient, requireUser } from "@/lib/auth";
import { scheduleDelivery } from "@/lib/notifications/trigger";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Demande libre du propriétaire. */
export async function createRequest(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireClient();
  const property_id = str(formData, "property_id");
  const subject = str(formData, "subject");
  const message = str(formData, "message");
  if (!property_id) return { error: "Choisissez votre maison." };
  if (!subject) return { error: "Décrivez votre demande en quelques mots." };
  const { error } = await supabase.rpc("create_request", { p_property_id: property_id, p_subject: subject, p_message: message || null });
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  redirect("/client/demandes?envoyee=1");
}

/** « Je viens dans ma maison » */
export async function declareStay(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireClient();
  const property_id = str(formData, "property_id");
  const arrival = str(formData, "arrival_date");
  const departure = str(formData, "departure_date");
  const options = formData.getAll("options").map(String).filter(Boolean);
  if (!property_id) return { error: "Choisissez votre maison." };
  if (!arrival || !departure) return { error: "Indiquez vos dates d’arrivée et de départ." };
  const { error } = await supabase.rpc("declare_stay", {
    p_property_id: property_id,
    p_arrival_date: arrival,
    p_arrival_time: str(formData, "arrival_time") || null,
    p_departure_date: departure,
    p_options: options,
    p_message: str(formData, "message") || null,
  });
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  redirect("/client/demandes?sejour=1");
}

/** Décision sur une intervention recommandée. */
export async function decideObservation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireClient();
  const id = str(formData, "observation_id");
  const decision = str(formData, "decision");
  if (!id || !["autorise", "contacter_avant", "client_gere"].includes(decision)) return { error: "Décision invalide." };
  const { error } = await supabase.rpc("decide_observation", { p_observation_id: id, p_decision: decision, p_message: str(formData, "message") || null });
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  const messages: Record<string, string> = {
    autorise: "Merci. Auxois Intendance organise l’intervention et vous tient informé.",
    contacter_avant: "Bien noté : nous vous contactons avant toute intervention.",
    client_gere: "Bien noté : vous vous en occupez vous-même.",
  };
  return { ok: true, message: messages[decision] };
}

export async function requestDataDeletion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("data_requests").insert({ user_id: user.id, kind: "suppression", message: str(formData, "message") || null });
  if (error) return { error: error.message };
  revalidatePath("/client/profil");
  return { ok: true, message: "Votre demande de suppression a été transmise. Nous revenons vers vous rapidement." };
}
