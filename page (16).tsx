import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { addDays, dayBounds, visitsOfDay } from "@/lib/queries";
import { formatDate, formatTime, fullName, todayParis } from "@/lib/format";
import { OBS_LEVEL, REQUEST_STATUS } from "@/lib/labels";
import type { AdminStats } from "@/lib/types";
import { VisitCard, type VisitCardData } from "@/components/admin/visit-card";
import { Badge, Card, EmptyState, List, Notice, PageHeader, Row, SectionTitle, StatTile } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Tableau de bord" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { supabase, profile } = await requireStaff();
  const { bienvenue } = await searchParams;
  const today = todayParis();
  const { end: todayEnd } = dayBounds(today);
  const { end: weekEnd } = dayBounds(addDays(today, 6));

  const [statsRes, todayVisits, weekRes, requestsRes, staysRes, urgentRes] = await Promise.all([
    supabase.rpc("admin_stats"),
    visitsOfDay(supabase, today),
    supabase
      .from("visits")
      .select("*, properties(id, name, commune, status, subscriptions(status, subscription_plans(name)))")
      .in("status", ["planifiee", "en_cours"])
      .gte("scheduled_at", todayEnd)
      .lt("scheduled_at", weekEnd)
      .order("scheduled_at")
      .limit(8),
    supabase
      .from("client_requests")
      .select("id, subject, status, kind, created_at, properties(name), clients(first_name, last_name)")
      .in("status", ["nouvelle", "vue"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("stays")
      .select("id, arrival_date, arrival_time, departure_date, status, properties(name), clients(first_name, last_name)")
      .gte("arrival_date", today)
      .not("status", "in", '("annule","termine")')
      .order("arrival_date")
      .limit(5),
    supabase
      .from("observations")
      .select("id, title, level, status, observed_at, properties(name)")
      .eq("level", "urgent")
      .not("status", "in", '("resolu","classe_sans_suite")')
      .order("observed_at", { ascending: false })
      .limit(5),
  ]);

  const stats = (statsRes.data ?? {}) as Partial<AdminStats>;
  const weekVisits = (weekRes.data ?? []) as unknown as VisitCardData[];
  const requests = requestsRes.data ?? [];
  const stays = staysRes.data ?? [];
  const urgent = urgentRes.data ?? [];

  const hello = profile.full_name ? profile.full_name.split(" ")[0] : "";

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={formatDate(new Date(), { weekday: true })}
        title={hello ? `Bonjour ${hello}` : "Tableau de bord"}
        subtitle="Vos maisons, vos visites et vos interventions, en un coup d’œil."
        actions={
          <>
            <LinkButton href="/admin/visites/nouvelle" variant="outline" icon="plus">
              Planifier une visite
            </LinkButton>
          </>
        }
      />

      {bienvenue && (
        <Notice tone="ok" className="mb-6">
          Bienvenue ! Votre application est prête. Explorez le tableau de bord, puis ouvrez <Link href="/admin/parametres" className="underline">Paramètres</Link> pour renseigner vos coordonnées et inviter votre équipe.
        </Notice>
      )}

      {urgent.length > 0 && (
        <div className="mb-6 rounded-2xl border border-danger-600/30 bg-danger-100 p-4">
          <p className="flex items-center gap-2 font-medium text-danger-600 mb-2">
            <Icon name="alert" size={20} /> Alertes urgentes
          </p>
          <ul className="space-y-1.5">
            {urgent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/observations/${o.id}`} className="text-[15px] text-ink-900 hover:underline">
                  <span className="font-medium">{(o.properties as unknown as { name: string } | null)?.name}</span> — {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatTile label="Propriétés actives" value={stats.proprietes_actives ?? 0} href="/admin/proprietes" />
        <StatTile label="Visites aujourd’hui" value={stats.visites_aujourdhui ?? 0} href="/admin/planning" />
        <StatTile label="Visites cette semaine" value={stats.visites_semaine ?? 0} href="/admin/planning" />
        <StatTile label="Interventions en cours" value={stats.interventions_ouvertes ?? 0} href="/admin/interventions" tone={stats.interventions_ouvertes ? "warn" : "neutral"} />
        <StatTile label="Anomalies non résolues" value={stats.observations_ouvertes ?? 0} href="/admin/observations" tone={stats.observations_ouvertes ? "warn" : "neutral"} />
        <StatTile label="Demandes en attente" value={stats.demandes_en_attente ?? 0} href="/admin/demandes" tone={stats.demandes_en_attente ? "danger" : "neutral"} />
        <StatTile label="Prochains séjours" value={stays.length} href="/admin/planning" />
        <StatTile label="Alertes urgentes" value={stats.alertes_urgentes ?? 0} tone={stats.alertes_urgentes ? "danger" : "neutral"} href="/admin/observations?niveau=urgent" />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div className="space-y-8">
          <section>
            <SectionTitle action={<Link href="/admin/planning" className="text-[14px] text-forest-700 hover:underline">Voir le planning</Link>}>
              Visites du jour
            </SectionTitle>
            {todayVisits.length ? (
              <div className="space-y-3">
                {(todayVisits as unknown as VisitCardData[]).map((v) => (
                  <VisitCard key={v.id} visit={v} />
                ))}
              </div>
            ) : (
              <EmptyState icon="sun" title="Aucune visite prévue aujourd’hui" action={<LinkButton href="/admin/visites/nouvelle" variant="secondary" icon="plus">Planifier une visite</LinkButton>} />
            )}
          </section>

          <section>
            <SectionTitle>Cette semaine</SectionTitle>
            {weekVisits.length ? (
              <div className="space-y-3">
                {weekVisits.map((v) => (
                  <VisitCard key={v.id} visit={v} showDay />
                ))}
              </div>
            ) : (
              <p className="text-ink-500 text-[15px]">Pas d’autre visite planifiée dans les 7 prochains jours.</p>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <SectionTitle action={<Link href="/admin/demandes" className="text-[14px] text-forest-700 hover:underline">Toutes</Link>}>
              Demandes clients
            </SectionTitle>
            {requests.length ? (
              <List>
                {requests.map((r) => {
                  const st = REQUEST_STATUS[r.status as keyof typeof REQUEST_STATUS];
                  return (
                    <Row
                      key={r.id}
                      href={`/admin/demandes/${r.id}`}
                      title={r.subject}
                      subtitle={`${(r.properties as unknown as { name: string } | null)?.name ?? ""} · ${fullName(r.clients as unknown as { first_name: string; last_name: string } | null)}`}
                      right={<Badge tone={st.tone}>{st.label}</Badge>}
                    />
                  );
                })}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucune demande en attente. 👌</Card>
            )}
          </section>

          <section>
            <SectionTitle>Prochains séjours</SectionTitle>
            {stays.length ? (
              <List>
                {stays.map((s) => (
                  <Row
                    key={s.id}
                    href="/admin/planning"
                    icon={<Icon name="house" size={20} />}
                    title={(s.properties as unknown as { name: string } | null)?.name ?? ""}
                    subtitle={`${fullName(s.clients as unknown as { first_name: string; last_name: string } | null)} · du ${formatDate(s.arrival_date, { year: false })} au ${formatDate(s.departure_date, { year: false })}${s.arrival_time ? ` · arrivée ${s.arrival_time}` : ""}`}
                  />
                ))}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucun séjour annoncé.</Card>
            )}
          </section>

          {urgent.length === 0 && (stats.observations_ouvertes ?? 0) > 0 && (
            <section>
              <SectionTitle>Points ouverts</SectionTitle>
              <Card className="text-[15px]">
                <Link href="/admin/observations" className="text-forest-700 hover:underline">
                  {stats.observations_ouvertes} observation{(stats.observations_ouvertes ?? 0) > 1 ? "s" : ""} à suivre
                </Link>
                <span className="text-ink-400"> · {OBS_LEVEL.a_surveiller.emoji} {OBS_LEVEL.intervention_recommandee.emoji}</span>
                <p className="text-ink-400 text-[13px] mt-1">Dernière mise à jour {formatTime(new Date())}</p>
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
