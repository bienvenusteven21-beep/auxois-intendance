import { requireClient } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { REQUEST_STATUS, STAY_STATUS } from "@/lib/labels";
import type { ClientRequestRow, StayRow } from "@/lib/types";
import { Badge, Card, EmptyState, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { PropertySwitcher, WaitingForActivation, pickProperty } from "@/components/client/property-context";

export const metadata = { title: "Mes demandes" };

export default async function ClientRequestsPage({ searchParams }: { searchParams: Promise<{ maison?: string; envoyee?: string; sejour?: string }> }) {
  const { supabase, properties } = await requireClient();
  const sp = await searchParams;
  const property = pickProperty(properties, sp.maison);
  if (!property) return <WaitingForActivation />;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: requests }, { data: stays }] = await Promise.all([
    supabase.from("client_requests").select("*").eq("property_id", property.id).order("created_at", { ascending: false }).limit(50).returns<ClientRequestRow[]>(),
    supabase.from("stays").select("*").eq("property_id", property.id).gte("departure_date", today).neq("status", "annule").order("arrival_date").returns<StayRow[]>(),
  ]);
  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader title="Mes demandes" subtitle="Dites-nous ce dont vous avez besoin : nous nous en occupons." />
      <PropertySwitcher properties={properties} current={property} basePath="/client/demandes" />
      {sp.envoyee && <Notice tone="ok" className="mb-5">Votre demande a bien été envoyée. Nous vous tenons informé de son avancement.</Notice>}
      {sp.sejour && <Notice tone="ok" className="mb-5">Votre séjour est enregistré. Nous préparons votre arrivée et vous prévenons quand la maison est prête.</Notice>}

      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        <LinkButton href={`/client/demandes/sejour?maison=${property.id}`} size="xl" variant="bronze" icon="house" full>
          Je viens dans ma maison
        </LinkButton>
        <LinkButton href={`/client/demandes/nouvelle?maison=${property.id}`} size="xl" variant="primary" icon="send" full>
          Faire une demande
        </LinkButton>
      </div>

      {stays?.length ? (
        <section className="mb-8">
          <SectionTitle>Séjours à venir</SectionTitle>
          <div className="space-y-3">
            {stays.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-forest-900">
                    Du {formatDate(s.arrival_date, { weekday: true })}
                    {s.arrival_time ? ` (${s.arrival_time})` : ""} au {formatDate(s.departure_date, { weekday: true })}
                  </p>
                  <Badge tone={STAY_STATUS[s.status].tone}>{STAY_STATUS[s.status].label}</Badge>
                </div>
                {s.options.length > 0 && <p className="text-[14px] text-ink-700 mt-2">{s.options.join(" · ")}</p>}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>Toutes mes demandes</SectionTitle>
        {requests?.length ? (
          <div className="space-y-3">
            {requests.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-forest-900 leading-snug">{r.subject}</p>
                    <p className="text-[13px] text-ink-500 mt-0.5">
                      Envoyée le {formatDateTime(r.created_at)}
                      {r.planned_for ? ` · prévue le ${formatDate(r.planned_for)}` : ""}
                    </p>
                  </div>
                  <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                </div>
                {r.message && <p className="text-[15px] text-ink-700 mt-2 whitespace-pre-line">{r.message}</p>}
                {r.reply && (
                  <div className="mt-3 rounded-xl bg-forest-50 px-4 py-3 text-[15px]">
                    <p className="text-[12px] uppercase tracking-wider text-forest-700 mb-1">Réponse</p>
                    <p className="text-ink-900 whitespace-pre-line">{r.reply}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon="inbox" title="Aucune demande pour l’instant" />
        )}
      </section>
    </div>
  );
}
