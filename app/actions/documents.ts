"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { scheduleDelivery } from "@/lib/notifications/trigger";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function revalidate(propertyId?: string | null, clientId?: string | null) {
  revalidatePath("/admin/documents");
  if (propertyId) revalidatePath(`/admin/proprietes/${propertyId}`);
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/client", "layout");
}

/** Enregistre un document déjà téléversé dans le bucket « documents ». */
export async function addDocumentRecord(input: {
  title: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  property_id?: string | null;
  client_id?: string | null;
  visit_id?: string | null;
  intervention_id?: string | null;
  category_id?: string | null;
  visibility: "interne" | "client";
}): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  if (!input.property_id && !input.client_id) return { error: "Rattachez le document à une propriété ou à un client." };
  const { error } = await supabase.from("documents").insert({ ...input, uploaded_by: user.id });
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidate(input.property_id, input.client_id);
  return { ok: true, message: "Document ajouté." };
}

export async function updateDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const id = str(formData, "document_id");
  const { data, error } = await supabase
    .from("documents")
    .update({
      title: str(formData, "title"),
      visibility: str(formData, "visibility") === "client" ? "client" : "interne",
      category_id: str(formData, "category_id") || null,
    })
    .eq("id", id)
    .select("property_id, client_id")
    .single();
  if (error) return { error: error.message };
  scheduleDelivery();
  revalidate(data.property_id, data.client_id);
  return { ok: true, message: "Document mis à jour." };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data: doc } = await supabase.from("documents").select("storage_path, property_id, client_id").eq("id", id).maybeSingle();
  if (!doc) return { error: "Document introuvable." };
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };
  await supabase.storage.from("documents").remove([doc.storage_path]);
  revalidate(doc.property_id, doc.client_id);
  return { ok: true };
}
