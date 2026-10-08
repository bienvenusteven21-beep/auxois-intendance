import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { HOUSE_STATUS, INTERVENTION_STATUS, REQUEST_STATUS } from "@/lib/labels";
import type { ClientRequestRow, DocumentRow, InterventionRow, ObservationRow, PhotoRow, VisitRow } from "@/lib/types";
import { Badge, Card, List, Row, SectionTitle } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PhotoGrid } from "@/components/photos";
import { DocumentList, type DocumentWithCategory } from "@/components/documents";
import { ObservationCard } from "@/components/observation-card";
import { DecisionForm } from "@/components/client/decision-form";
import { PropertySwitcher, WaitingForActivation, pickProperty } from "@/components/client/property-context";
import { acceptPolicy } from "@/app/actions/auth";
import { ActionButton } from "@/components/ui/form";
import { getSettings } from "@/lib/auth";

export const metadata = { title: "Accueil" };

export default async function ClientHome({ searchParams }: { searchParams: Promise<{ maison?: string }> }) {
  const { supabase, user, profile, properties, client } = await requireClient();
  const { maison } = await searchParams;
  const property = pickProperty(properties, maison);
  if (!property) return <WaitingForActivation />;
  const settings = await getSettings();

  const now = new Date().toISOString();
  const [lastRes, nextRes, pendingRes, intRes, photosRes, reqRes, docsRes, consentRes] = await Promise.all([
    supabase.from("visits").select("*").eq("property_id", property.id).eq("status", "terminee").not("debrief_sent_at", "is", null).order("ended_at", { ascending: false }).limit(1).maybeSingle<VisitRow>(),
    supabase.from("visits").select("*").eq("property_id", property.id).eq("status", "planifiee").gte("scheduled_at", now).order("scheduled_at").limit(1).maybeSingle<VisitRow>(),
    supabase.from("observations").select("*").eq("property_id", property.id).eq("status", "en_attente_client").order("observed_at", { ascending: false }).returns<ObservationRow[]>(),
    supabase.from("interventions").select("*").eq("property_id", property.id).not("status", "in", '("terminee","annulee")').order("scheduled_at", { ascending: true, nullsFirst: false }).returns<InterventionRow[]>(),
    supabase.from("photos").select("*").eq("property_id", property.id).order("taken_at", { ascending: false }).limit(4).returns<PhotoRow[]>(),
    supabase.from("client_requests").select("*").eq("property_id", property.id).order("created_at", { ascending: false }).limit(3).returns<ClientRequestRow[]>(),
    supabase.from("documents").select("*, document_categories(name)").or(`property_id.eq.${property.id},client_id.eq.${client?.id ?? property.id}`).order("created_at", { ascending: false }).limit(3).returns<DocumentWithCategory[]>(),
    supabase.from("consents").select("id").eq("user_id", user.id).eq("policy_version", settings.privacy_policy_version).maybeSingle(),
  ]);

  const st = HOUSE_STATUS[property.status];
  const last = lastRes.data;
  const next = nextRes.data;
  const pending = pendingRes.data ?? [];
  const interventions = intRes.data ?? [];
  const upcoming = interventions.filter((i) => i.scheduled_at && i.scheduled_at >= now);
  const inProgress = interventions.filter((i) => !i.scheduled_at || i.scheduled_at < now);
  const firstName = profile.full_name.split(" ")[0];

  const heroClass = st.tone === "ok" ? "bg-forest-900 text-cream" : st.tone === "warn" ? "bg-warn-600 text-white" : "bg-danger-600 text-white";

  return (
    <div className="animate-fade-up">
      {!consentRes.data && (
        <Card className="mb-5 border-bronze-200 bg-bronze-100/60">
          <p className="text-[15px] text-ink-900 mb-3">
            Pour utiliser votre espace, merci d’accepter notre{" "}
            <Link href="/confidentialite" className="underline" target="_blank">politique de confidentialité</Link> (version {settings.privacy_policy_version}).
          </p>
          <ActionButton action={acceptPolicy} variant="primary" icon="check">J’accepte</ActionButton>
        </Card>
      )}

      <p className="text-[13px] uppercase tracking-[0.14em] text-bronze-600 font-medium mb-1">Ma maison{firstName ? ` · Bonjour ${firstName}` : ""}</p>
      <PropertySwitcher properties={properties} current={property} basePath="/client" />

      <section className={`rounded-3xl p-6 md:p-8 mb-6 shadow-soft ${heroClass}`}>
        <p className="font-serif text-[30px] md:text-[36px] leading-tight">{property.name}</p>
        <p className="mt-4 flex items-center gap-3 text-[22px] md:text-[26px] font-serif leading-tight">
          <span className="text-[30px] leading-none">{st.emoji}</span>
          {st.client}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-[15px]">
          <div>
            <p className="opacity-70">Dernière visite</p>
            <p className="font-medium text-[17px]">{last ? `${formatDate(last.ended_at)} · ${formatTime(last.ended_at)}` : "—"}</p>
          </div>
          <div>
            <p className="opacity-70">Prochaine visite</p>
            <p className="font-medium text-[17px]">{next ? formatDate(next.scheduled_at) : "À planifier"}</p>
          </div>
        </div>
      </section>

      <LinkButton href={`/client/demandes/sejour?maison=${property.id}`} size="xl" variant="bronze" full icon="house" className="mb-8">
        Je viens dans ma maison
      </LinkButton>

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

      <div className="grid lg:grid-cols-2 gap-8">
        <section>
          <SectionTitle action={last ? <Link href={`/client/visites/${last.id}`} className="text-[14px] text-forest-700 hover:underline">Voir le débrief</Link> : null}>Dernier débrief</SectionTitle>
          {last ? (
            <Link href={`/client/visites/${last.id}`} className="block">
              <Card className="hover:border-forest-300 transition">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[26px]">{last.general_status ? HOUSE_STATUS[last.general_status].emoji : "✅"}</span>
                  <div>
                    <p className="font-medium text-forest-900">Visite du {formatDate(last.ended_at)}</p>
                    <p className="text-[13px] text-ink-500">{last.intendant_name ? `par ${last.intendant_name} · ` : ""}État général : {last.general_status ? HOUSE_STATUS[last.general_status].short : ""}</p>
                  </div>
                </div>
                {last.intendant_comment && <p className="font-serif text-[16px] leading-relaxed text-ink-900 line-clamp-4 whitespace-pre-line">{last.intendant_comment}</p>}
                <p className="mt-3 text-[14px] text-forest-700 flex items-center gap-1">Lire le débrief complet <Icon name="chevron" size={16} /></p>
              </Card>
            </Link>
          ) : (
            <Card className="text-[15px] text-ink-500">Votre premier débrief apparaîtra ici après la prochaine visite.</Card>
          )}
        </section>

        <section>
          <SectionTitle action={<Link href="/client/interventions" className="text-[14px] text-forest-700 hover:underline">Tout voir</Link>}>Interventions en cours</SectionTitle>
          {inProgress.length ? (
            <List>
              {inProgress.map((i) => (
                <Row key={i.id} href="/client/interventions" icon={<Icon name="wrench" size={20} />} title={i.title} subtitle={i.partner_name ?? "Artisan en cours de sélection"} right={<Badge tone={INTERVENTION_STATUS[i.status].tone}>{INTERVENTION_STATUS[i.status].label}</Badge>} />
              ))}
            </List>
          ) : (
            <Card className="text-[15px] text-ink-500">Aucune intervention en cours.</Card>
          )}
          {upcoming.length > 0 && (
            <>
              <SectionTitle className="mt-5">Prochaines interventions</SectionTitle>
              <List>
                {upcoming.map((i) => (
                  <Row key={i.id} href="/client/interventions" icon={<Icon name="calendar" size={20} />} title={i.title} subtitle={`${i.partner_name ?? "Artisan"} · ${formatDateTime(i.scheduled_at)}`} />
                ))}
              </List>
            </>
          )}
        </section>

        <section>
          <SectionTitle action={<Link href="/client/historique" className="text-[14px] text-forest-700 hover:underline">Historique</Link>}>Dernières photos</SectionTitle>
          {photosRes.data?.length ? <PhotoGrid photos={photosRes.data} columns="grid-cols-2" /> : <Card className="text-[15px] text-ink-500">Les photos de votre maison apparaîtront ici après chaque visite.</Card>}
        </section>

        <section>
          <SectionTitle action={<Link href="/client/demandes" className="text-[14px] text-forest-700 hover:underline">Toutes</Link>}>Mes demandes</SectionTitle>
          {reqRes.data?.length ? (
            <List>
              {reqRes.data.map((r) => (
                <Row key={r.id} href="/client/demandes" title={r.subject} subtitle={formatDate(r.created_at)} right={<Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>} />
              ))}
            </List>
          ) : (
            <Card className="text-[15px] text-ink-500">
              Une question, un besoin ? <Link href="/client/demandes/nouvelle" className="text-forest-700 underline">Faites-nous une demande</Link>.
            </Card>
          )}
          <SectionTitle className="mt-5" action={<Link href="/client/documents" className="text-[14px] text-forest-700 hover:underline">Tous</Link>}>Mes documents</SectionTitle>
          {docsRes.data?.length ? <DocumentList documents={docsRes.data as (DocumentRow & { document_categories: { name: string } | null })[]} /> : <Card className="text-[15px] text-ink-500">Aucun document pour l’instant.</Card>}
        </section>
      </div>
    </div>
  );
}
