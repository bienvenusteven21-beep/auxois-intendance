import Link from "next/link";
import { Badge, Dot } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { formatTime, relativeDay } from "@/lib/format";
import { HOUSE_STATUS, VISIT_KIND, VISIT_STATUS } from "@/lib/labels";
import { activePlanName } from "@/lib/queries";
import type { HouseStatus, VisitKind, VisitStatus } from "@/lib/types";
import { startVisit } from "@/app/actions/visites";

export interface VisitCardData {
  id: string;
  scheduled_at: string;
  status: VisitStatus;
  kind: VisitKind;
  properties: {
    id: string;
    name: string;
    commune: string | null;
    status: HouseStatus;
    subscriptions?: { status: string; subscription_plans: { name: string } | null }[] | null;
  } | null;
}

export function VisitCard({ visit, showDay = false }: { visit: VisitCardData; showDay?: boolean }) {
  const p = visit.properties;
  const plan = activePlanName(p);
  const canStart = visit.status === "planifiee" || visit.status === "en_cours";
  return (
    <article className="flex items-stretch gap-4 bg-white rounded-2xl border border-stone-200/60 shadow-soft p-4">
      <div className="w-[64px] shrink-0 text-center border-r border-stone-200 pr-4">
        <p className="font-serif text-[22px] text-forest-900 leading-none">{formatTime(visit.scheduled_at)}</p>
        {showDay && <p className="text-[11px] text-ink-500 mt-1 leading-tight">{relativeDay(visit.scheduled_at)}</p>}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/admin/visites/${visit.id}`} className="font-medium text-forest-900 hover:underline leading-snug flex items-center gap-2">
          <Dot tone={HOUSE_STATUS[p?.status ?? "bon"].tone} />
          <span className="truncate">{p?.name ?? "Propriété"}</span>
        </Link>
        <p className="text-[14px] text-ink-500 truncate">
          {p?.commune ?? ""}
          {plan ? ` · Formule ${plan}` : ""}
        </p>
        <p className="text-[13px] text-ink-400 mt-0.5">
          {VISIT_KIND[visit.kind]}
          {visit.status === "en_cours" && (
            <Badge tone="warn" className="ml-2">
              {VISIT_STATUS.en_cours.label}
            </Badge>
          )}
        </p>
      </div>
      {canStart && (
        <form action={startVisit.bind(null, visit.id)} className="self-center shrink-0">
          <button type="submit" className={buttonClass(visit.status === "en_cours" ? "bronze" : "primary", "md", "px-3")}>
            <Icon name="play" size={18} />
            <span className="hidden sm:inline">{visit.status === "en_cours" ? "Reprendre" : "Démarrer la visite"}</span>
            <span className="sm:hidden">{visit.status === "en_cours" ? "Reprendre" : "Démarrer"}</span>
          </button>
        </form>
      )}
    </article>
  );
}
