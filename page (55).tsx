import { requireClient } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { INTERVENTION_STATUS } from "@/lib/labels";
import type { InterventionRow, ObservationRow, PhotoRow } from "@/lib/types";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { ObservationCard } from "@/components/observation-card";
import { PhotoGrid } from "@/components/photos";
import { DecisionForm } from "@/components/client/decision-form";
import { PropertySwitcher, WaitingForActivation, pickProperty } from "@/components/client/property-context";
import { getSettings } from "@/lib/auth";

export const metadata = { title: "Interventions" };

export default async function ClientInterventionsPage({ searchParams }: { searchParams: Promise<{ maison?: string }> }) {
  const { supabase, properties } = await requireClient();
  const { maison } = await searchParams;
  const property = pickProperty(properties, maison);
  if (!property) return <WaitingForActivation />;
  const settings = await getSettings();

  const [obsRes, intRes, photosRes] = await Promise.all([
    supabase.from("observations").select("*").eq("property_id", property.id).neq("level", "information").order("observed_at", { ascending: false }).limit(50).returns<ObservationRow[]>(),
    supabase.from("interventions").select("*").eq("property_id", property.id).order("created_at", { ascending: false }).limit(50).returns<InterventionRow[]>(),
    supabase.from("photos").select("*").eq("property_id", property.id).not("intervention_id", "is", null).order("taken_at").returns<PhotoRow[]>(),
  ]);
  const observations = obsRes.data ?? [];
  const pending = observations.filter((o) => o.status === "en_attente_client");
  const interventions = intRes.data ?? [];
  const open = interventions.filter((i) => !["terminee", "annulee"].includes(i.status));
  const closed = interventions.filter((i) => ["terminee", "annulee"].includes(i.status));
  const watch = observations.filter((o) => o.status !== "en_attente_client" && !["resolu", "classe_sans_suite"].includes(o.status) && !interventions.some((i) => i.observation_id === o.id));
  const photos = photosRes.data ?? [];

  const InterventionCard = ({ i }: { i: InterventionRow }) => {
    const st = INTERVENTION_STATUS[i.status];
    const obs = observations.find((o) => o.id === i.observation_id);
    const before = photos.filter((p) => p.intervention_id === i.id && p.phase === "avant");
    const after = photos.filter((p) => p.intervention_id === i.id && p.phase === "apres");
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-forest-900 text-[17px] leading-snug">{i.title}</p>
            <p className="text-[14px] text-ink-500 mt-0.5">
              {i.partner_name ?? "Artisan en cours de sélection"}
              {i.scheduled_at ? ` · ${formatDateTime(i.scheduled_at)}` : ""}
            </p>
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        {i.description && <p className="text-[15px] text-ink-700 mt-2">{i.description}</p>}
        {i.status === "terminee" && (
          <div className="mt-3 rounded-xl bg-ok-100 px-4 py-3 text-[15px]">
            <p className="font-medium text-ok-600 flex items-center gap-2"><Icon name="check" size={18} /> Intervention terminée le {formatDate(i.completed_at)}</p>
            <p className="text-ink-700 mt-1">
              {obs ? `Le problème constaté le ${formatDate(obs.observed_at)} a été résolu.` : "Le problème a été résolu."}
              {i.final_cost != null && ` Coût : ${formatMoney(i.final_cost)}.`}
            </p>
            {i.report && <p className="text-ink-700 mt-2 whitespace-pre-line">{i.report}</p>}
          </div>
        )}
        {(before.length > 0 || after.length > 0) && (
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {before.length > 0 && (
              <div>
                <p className="text-[12px] uppercase tracking-wider text-ink-500 mb-1.5">Avant</p>
                <PhotoGrid photos={before} columns="grid-cols-2" />
              </div>
            )}
            {after.length > 0 && (
              <div>
                <p className="text-[12px] uppercase tracking-wider text-ink-500 mb-1.5">Après</p>
                <PhotoGrid photos={after} columns="grid-cols-2" />
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader title="Interventions" subtitle="Les points signalés et les travaux organisés pour votre maison." />
      <PropertySwitcher properties={properties} current={property} basePath="/client/interventions" />

      {pending.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Votre décision est attendue</SectionTitle>
          <div className="space-y-4">
            {pending.map((o) => (
              <ObservationCard key={o.id} o={o}>
                <p className="text-[15px] text-ink-700 mt-3">{settings.company_name} recommande une intervention. Que souhaitez-vous faire ?</p>
                <DecisionForm observationId={o.id} />
              </ObservationCard>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <SectionTitle>En cours</SectionTitle>
        {open.length ? <div className="space-y-3">{open.map((i) => <InterventionCard key={i.id} i={i} />)}</div> : <Card className="text-[15px] text-ink-500">Aucune intervention en cours.</Card>}
      </section>

      {watch.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Points suivis par votre intendant</SectionTitle>
          <div className="space-y-3">
            {watch.map((o) => (
              <ObservationCard key={o.id} o={o} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Terminées</SectionTitle>
        {closed.length ? <div className="space-y-3">{closed.map((i) => <InterventionCard key={i.id} i={i} />)}</div> : <EmptyState icon="wrench" title="Aucune intervention passée" />}
      </section>
    </div>
  );
}
