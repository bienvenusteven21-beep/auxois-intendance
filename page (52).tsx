import { after } from "next/server";
import { requireClient } from "@/lib/auth";
import type { NotificationRow } from "@/lib/types";
import { NotificationsView } from "@/components/notifications-list";

export const metadata = { title: "Notifications" };

export default async function ClientNotificationsPage() {
  const { supabase, user } = await requireClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60).returns<NotificationRow[]>();
  const list = data ?? [];
  if (list.some((n) => !n.read_at)) {
    after(async () => {
      await supabase.rpc("mark_all_notifications_read");
    });
  }
  return <NotificationsView notifications={list} basePath="/client" />;
}
