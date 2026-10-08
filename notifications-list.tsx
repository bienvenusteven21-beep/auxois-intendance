import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { NotificationRow } from "@/lib/types";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ActionButton } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { markAllRead } from "@/app/actions/notifications";
import { PushToggle } from "./push-toggle";

export function NotificationsView({ notifications, basePath }: { notifications: NotificationRow[]; basePath: "/admin" | "/client" }) {
  const unread = notifications.filter((n) => !n.read_at).length;
  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Vous êtes à jour."}
        actions={unread ? <ActionButton action={markAllRead} variant="secondary" icon="check">Tout marquer comme lu</ActionButton> : null}
      />
      <Card className="mb-5">
        <PushToggle />
      </Card>
      {notifications.length === 0 ? (
        <EmptyState icon="bell" title="Aucune notification pour l’instant" />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const href = n.link && n.link.startsWith(basePath) ? n.link : basePath;
            return (
              <li key={n.id}>
                <Link href={href} className={`block rounded-2xl border p-4 transition hover:border-forest-300 ${n.read_at ? "bg-white border-stone-200/60" : "bg-forest-50 border-forest-200"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${n.read_at ? "bg-transparent" : "bg-bronze-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-forest-900 leading-snug">{n.title}</p>
                      <p className="text-[15px] text-ink-700 mt-1 whitespace-pre-line">{n.body}</p>
                      <p className="text-[12px] text-ink-400 mt-2">{formatDateTime(n.created_at)}</p>
                    </div>
                    <Icon name="chevron" size={18} className="text-ink-300 shrink-0" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
