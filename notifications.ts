"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export async function markAllRead(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markRead(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Enregistre l’abonnement push du navigateur. */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent ?? null }, { onConflict: "endpoint" });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}
