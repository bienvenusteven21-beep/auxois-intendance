import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { HOUSE_STATUS, OBS_LEVEL, TIMELINE_ICON } from "@/lib/labels";
import type { HouseStatus, ObservationLevel, TimelineRow } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { PropertySwitcher, WaitingForActivation, pickProperty } from "@/components/client/property-context";

export const metadata = { title: "Historique" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ maison?: string; annee?: string }> }) {
  const { supabase, properties } = await requireClient();
  const { maison, annee } = await searchParams;
  const property = pickProperty(properties, maison);
  if (!property) return <WaitingForActivation />;

  const { data } = await supabase.from("property_timeline").select("*").eq("property_id", property.id).order("happened_at", { ascending: false }).limit(500).returns<TimelineRow[]>();
  const events = data ?? [];
  const years = [...new Set(events.map((e) => e.happened_at.slice(0, 4)))];
  const year = annee && years.includes(annee) ? annee : years[0];
  const shown = events.filter((e) => e.happened_at.startsWith(year ?? ""));
  const months = [...new Set(shown.map((e) => e.happened_at.slice(0, 7)))];

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Carnet de santé de la maison" title="Historique" subtitle={property.name} />
      <PropertySwitcher properties={properties} current={property} basePath="/client/historique" />
      {years.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {years.map((y) => (
            <Link key={y} href={`/client/historique?maison=${property.id}&annee=${y}`} className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-medium ${y === year ? "bg-forest-800 text-cream" : "bg-white border border-stone-200 text-forest-900"}`}>
              {y}
            </Link>
          ))}
        </div>
      )}
      {events.length === 0 ? (
        <EmptyState icon="history" title="L’histoire de votre maison commence ici">Chaque visite, observation et intervention viendra s’ajouter à cette frise.</EmptyState>
      ) : (
        <div className="max-w-2xl">
          {months.map((m) => (
            <section key={m} className="mb-6">
              <h2 className="text-[13px] uppercase tracking-[0.14em] text-ink-500 font-sans font-semibold mb-3 capitalize">
                {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(m + "-15T12:00:00Z"))}
              </h2>
              <ol className="relative border-l-2 border-stone-200 ml-3 space-y-4">
                {shown
                  .filter((e) => e.happened_at.startsWith(m))
                  .map((e) => {
                    const href = e.kind === "visite" ? `/client/visites/${e.entity_id}` : e.kind === "intervention" || e.kind === "observation" ? "/client/interventions" : "/client/demandes";
                    const detail =
                      e.kind === "visite" && e.detail ? HOUSE_STATUS[e.detail as HouseStatus]?.label : e.kind === "observation" && e.detail ? OBS_LEVEL[e.detail as ObservationLevel]?.label : e.detail;
                    return (
                      <li key={`${e.kind}-${e.entity_id}`} className="ml-6 relative">
                        <span className="absolute -left-[37px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white border-2 border-stone-200 text-[14px]">{TIMELINE_ICON[e.kind]}</span>
                        <Link href={href} className="block rounded-2xl bg-white border border-stone-200/60 shadow-soft p-4 hover:border-forest-300 transition">
                          <p className="text-[13px] text-ink-500">{formatDate(e.happened_at, { weekday: true, year: false })}</p>
                          <p className="font-medium text-forest-900 leading-snug mt-0.5">{e.title}</p>
                          {detail && <p className="text-[14px] text-ink-500 mt-0.5">{detail}</p>}
                          <span className="mt-1 text-[13px] text-forest-700 inline-flex items-center gap-1">Voir <Icon name="chevron" size={14} /></span>
                        </Link>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
