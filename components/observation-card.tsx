import Link from "next/link";
import { Badge } from "./ui/primitives";
import { formatDate, formatRange } from "@/lib/format";
import { OBS_LEVEL, OBS_STATUS, OBS_STATUS_STAFF } from "@/lib/labels";
import type { ObservationRow } from "@/lib/types";

export function ObservationCard({
  o,
  href,
  staff = false,
  propertyName,
  children,
}: {
  o: Pick<ObservationRow, "id" | "title" | "description" | "level" | "status" | "recommended_action" | "estimate_min" | "estimate_max" | "observed_at" | "is_shared">;
  href?: string;
  staff?: boolean;
  propertyName?: string | null;
  children?: React.ReactNode;
}) {
  const level = OBS_LEVEL[o.level];
  const status = OBS_STATUS[o.status];
  const title = (
    <p className="font-medium text-forest-900 leading-snug">
      <span className="mr-1.5">{level.emoji}</span>
      {o.title}
    </p>
  );
  return (
    <article className="bg-white rounded-2xl border border-stone-200/60 shadow-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
          <p className="text-[13px] text-ink-500 mt-0.5">
            {level.label} · {formatDate(o.observed_at)}
            {propertyName ? ` · ${propertyName}` : ""}
          </p>
        </div>
        <Badge tone={status.tone}>{staff ? OBS_STATUS_STAFF[o.status] : status.label}</Badge>
      </div>
      {o.description && <p className="text-[15px] text-ink-700 mt-2 whitespace-pre-line">{o.description}</p>}
      {o.recommended_action && (
        <p className="text-[15px] mt-2">
          <span className="text-ink-500">Action recommandée : </span>
          {o.recommended_action}
        </p>
      )}
      {(o.estimate_min != null || o.estimate_max != null) && (
        <p className="text-[15px] mt-1">
          <span className="text-ink-500">Coût estimatif : </span>
          {formatRange(o.estimate_min, o.estimate_max)}
        </p>
      )}
      {staff && !o.is_shared && <p className="text-[13px] text-bronze-600 mt-2">Non encore partagée au propriétaire (le sera à l’envoi du débrief).</p>}
      {children}
    </article>
  );
}
