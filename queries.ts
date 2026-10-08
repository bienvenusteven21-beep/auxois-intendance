import type { SupabaseClient } from "@supabase/supabase-js";
import { parisToIso, todayParis } from "./format";
import type { PlanRow, SubscriptionRow } from "./types";

/** Bornes UTC d’une journée (heure de Paris). */
export function dayBounds(date: string) {
  const start = parisToIso(date, "00:00")!;
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const end = parisToIso(d.toISOString().slice(0, 10), "00:00")!;
  return { start, end };
}

export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const VISIT_WITH_PROPERTY =
  "*, properties(id, name, commune, status, subscriptions(status, visits_per_year_override, subscription_plans(name, code, visits_per_year)))";

export type SubscriptionWithPlan = SubscriptionRow & { subscription_plans: PlanRow | null };

/** Nom de la formule active d’une propriété (jointure subscriptions → subscription_plans). */
export function activePlanName(property: unknown) {
  const subs = (property as { subscriptions?: unknown } | null | undefined)?.subscriptions;
  const list = Array.isArray(subs) ? subs : subs ? [subs] : [];
  const s = (list as { status: string; subscription_plans: unknown }[]).find((x) => x.status === "actif");
  const plan = s?.subscription_plans;
  const p = Array.isArray(plan) ? plan[0] : plan;
  return (p as { name?: string } | null | undefined)?.name ?? null;
}

export async function visitsOfDay(supabase: SupabaseClient, date = todayParis()) {
  const { start, end } = dayBounds(date);
  const { data } = await supabase
    .from("visits")
    .select(VISIT_WITH_PROPERTY)
    .in("status", ["planifiee", "en_cours"])
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at");
  return data ?? [];
}

export async function unreadCount(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}
