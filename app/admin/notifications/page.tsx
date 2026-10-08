import { after } from "next/server";
import { requireStaff } from "@/lib/auth";
import type { NotificationRow } from "@/lib/types";
import { NotificationsView } from "@/components/notifications-list";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  const { supabase, user } = await requireStaff();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60).returns<NotificationRow[]>();
  const list = data ?? [];
  // Les notifications affichées sont marquées lues une fois la page envoyée.
  if (list.some((n) => !n.read_at)) {
    after(async () => {
      await supabase.rpc("mark_all_notifications_read");
    });
  }
  return <NotificationsView notifications={list} basePath="/admin" />;
}
