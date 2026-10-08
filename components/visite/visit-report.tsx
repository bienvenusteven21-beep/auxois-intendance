import { Badge, Card, Dot, SectionTitle } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { PhotoGrid } from "@/components/photos";
import { ObservationCard } from "@/components/observation-card";
import { formatDateTime, minutesBetween } from "@/lib/format";
import { HOUSE_STATUS } from "@/lib/labels";
import type { ObservationRow, PhotoRow, VisitItemRow, VisitRow, VisitSummary } from "@/lib/types";

export function SummaryTiles({ summary }: { summary: VisitSummary | null }) {
  if (!summary) return null;
  const tiles = [
    { label: "points contrôlés", value: summary.points_controles },
    { label: "OK", value: summary.ok, tone: "text-ok-600" },
    { label: summary.anomalies > 1 ? "anomalies" : "anomalie", value: summary.anomalies, tone: summary.anomalies ? "text-warn-600" : "" },
    { label: summary.observations > 1 ? "observations" : "observation", value: summary.observations },
    { label: summary.interventions_recommandees > 1 ? "interventions recommandées" : "intervention recommandée", value: summary.interventions_recommandees, tone: summary.interventions_recommandees ? "text-warn-600" : "" },
    { label: summary.photos > 1 ? "photos" : "photo", value: summary.photos },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl bg-white border border-stone-200/60 p-3 text-center">
          <p className={`font-serif text-[28px] leading-none ${t.tone ?? "text-forest-900"}`}>{t.value}</p>
          <p className="text-[12px] text-ink-500 mt-1 leading-tight">{t.label}</p>
        </div>
      ))}
    </div>
  );
}

export function ChecklistResults({ items }: { items: VisitItemRow[] }) {
  const categories = [...new Set(items.map((i) => i.category))];
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {categories.map((cat) => (
        <Card key={cat} className="!p-0 overflow-hidden">
          <p className="px-4 py-2 bg-forest-50 text-[12px] uppercase tracking-[0.12em] font-sans font-semibold text-forest-800">{cat}</p>
          <ul className="divide-y divide-stone-100">
            {items
              .filter((i) => i.category === cat)
              .map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2 text-[15px]">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${i.result === "ok" ? "bg-ok-100 text-ok-600" : i.result === "anomalie" ? "bg-warn-100 text-warn-600" : "bg-stone-100 text-ink-300"}`}>
                    <Icon name={i.result === "ok" ? "check" : i.result === "anomalie" ? "alert" : "more"} size={14} strokeWidth={2.4} />
                  </span>
                  <span className="flex-1 text-ink-700">{i.label}</span>
                  {i.kind === "number" && i.value_number != null && (
                    <span className="font-medium text-forest-900">
                      {i.value_number} {i.unit}
                    </span>
                  )}
                  {i.result === "non_controle" && <span className="text-[12px] text-ink-400">non contrôlé</span>}
                </li>
              ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export function VisitReport({
  visit,
  items,
  observations,
  photos,
  summary,
  staff,
  observationHref,
}: {
  visit: VisitRow;
  items: VisitItemRow[];
  observations: ObservationRow[];
  photos: PhotoRow[];
  summary: VisitSummary | null;
  staff: boolean;
  observationHref: (id: string) => string;
}) {
  const st = visit.general_status ? HOUSE_STATUS[visit.general_status] : null;
  const duration = minutesBetween(visit.started_at, visit.ended_at);
  const anomalies = items.filter((i) => i.result === "anomalie");
  return (
    <div className="space-y-6">
      {st && (
        <div className={`rounded-2xl p-5 flex items-center gap-4 ${st.tone === "ok" ? "bg-ok-100" : st.tone === "warn" ? "bg-warn-100" : "bg-danger-100"}`}>
          <span className="text-[40px] leading-none">{st.emoji}</span>
          <div>
            <p className="text-[13px] uppercase tracking-[0.12em] text-ink-500">État général</p>
            <p className="font-serif text-[26px] text-forest-900 leading-tight">{st.short}</p>
            <p className="text-[14px] text-ink-500">
              Contrôlée le {formatDateTime(visit.ended_at)}
              {visit.intendant_name ? ` par ${visit.intendant_name}` : ""}
              {duration ? ` · ${duration} min` : ""}
            </p>
          </div>
        </div>
      )}

      <SummaryTiles summary={summary} />

      {visit.intendant_comment && (
        <section>
          <SectionTitle>Commentaire de l’intendant</SectionTitle>
          <Card className="border-l-4 border-l-bronze-400">
            <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink-900 font-serif">{visit.intendant_comment}</p>
          </Card>
        </section>
      )}

      {(visit.indoor_temperature != null || visit.mail_count != null) && (
        <div className="flex flex-wrap gap-2">
          {visit.indoor_temperature != null && (
            <Badge tone="info" className="text-[14px] py-1">
              <Icon name="thermo" size={16} /> {visit.indoor_temperature} °C à l’intérieur
            </Badge>
          )}
          {visit.mail_count != null && (
            <Badge tone="neutral" className="text-[14px] py-1">
              <Icon name="mail" size={16} /> {visit.mail_count} courrier{visit.mail_count > 1 ? "s" : ""} relevé{visit.mail_count > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {observations.length > 0 && (
        <section>
          <SectionTitle>Observations</SectionTitle>
          <div className="space-y-3">
            {observations.map((o) => (
              <ObservationCard key={o.id} o={o} staff={staff} href={observationHref(o.id)} />
            ))}
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section>
          <SectionTitle>Photos ({photos.length})</SectionTitle>
          <PhotoGrid photos={photos} staff={staff} />
        </section>
      )}

      <section>
        <SectionTitle>
          Checklist {anomalies.length > 0 && <span className="normal-case tracking-normal text-warn-600 ml-1">· {anomalies.length} point{anomalies.length > 1 ? "s" : ""} en anomalie</span>}
        </SectionTitle>
        <ChecklistResults items={items} />
      </section>
      <p className="text-[13px] text-ink-400 flex items-center gap-1">
        <Dot tone="neutral" /> Rapport établi par l’application Auxois Intendance.
      </p>
    </div>
  );
}
