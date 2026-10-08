import { requireStaff } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import type { AdminStats, PlanRow } from "@/lib/types";
import { Card, PageHeader, SectionTitle, StatTile } from "@/components/ui/primitives";

export const metadata = { title: "Statistiques" };

export default async function StatsPage() {
  const { supabase } = await requireStaff();
  const [{ data }, { data: plans }] = await Promise.all([supabase.rpc("admin_stats"), supabase.from("subscription_plans").select("*").order("position").returns<PlanRow[]>()]);
  const s = (data ?? {}) as Partial<AdminStats>;
  const subs = s.abonnements ?? {};
  const totalSubs = Object.values(subs).reduce((a, b) => a + b, 0);
  return (
    <div className="animate-fade-up">
      <PageHeader title="Statistiques" subtitle="L’activité d’Auxois Intendance en chiffres." />
      <SectionTitle>Portefeuille</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatTile label="Propriétés" value={s.proprietes_actives ?? 0} href="/admin/proprietes" />
        <StatTile label="Clients" value={s.clients ?? 0} href="/admin/clients" />
        <StatTile label="Nouveaux clients ce mois" value={s.nouveaux_clients_mois ?? 0} />
        <StatTile label="Revenu mensuel récurrent" value={formatMoney(s.revenu_mensuel_recurrent ?? 0)} hint="Abonnements actifs" />
      </div>

      <SectionTitle>Abonnements</SectionTitle>
      <Card className="mb-8">
        <ul className="space-y-3">
          {(plans ?? []).map((p) => {
            const n = subs[p.code] ?? 0;
            const pct = totalSubs ? Math.round((n / totalSubs) * 100) : 0;
            return (
              <li key={p.id}>
                <div className="flex justify-between text-[15px] mb-1">
                  <span className="font-medium text-forest-900">
                    {p.name} <span className="text-ink-500 font-normal">· {p.monthly_price} €/mois</span>
                  </span>
                  <span>
                    {n} abonnement{n > 1 ? "s" : ""} ({pct} %)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full bg-forest-600 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <SectionTitle>Activité</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatTile label="Visites réalisées (total)" value={s.visites_realisees ?? 0} />
        <StatTile label="Visites réalisées ce mois" value={s.visites_realisees_mois ?? 0} />
        <StatTile label="Durée moyenne d’une visite" value={s.duree_moyenne_visite_min ? `${s.duree_moyenne_visite_min} min` : "—"} />
        <StatTile label="Visites prévues cette semaine" value={s.visites_semaine ?? 0} href="/admin/planning" />
        <StatTile label="Observations ouvertes" value={s.observations_ouvertes ?? 0} tone={s.observations_ouvertes ? "warn" : "neutral"} href="/admin/observations" />
        <StatTile label="Interventions ouvertes" value={s.interventions_ouvertes ?? 0} tone={s.interventions_ouvertes ? "warn" : "neutral"} href="/admin/interventions" />
        <StatTile label="Demandes clients (total)" value={s.demandes_total ?? 0} hint={`${s.demandes_en_attente ?? 0} en attente`} href="/admin/demandes" />
        <StatTile label="Alertes urgentes" value={s.alertes_urgentes ?? 0} tone={s.alertes_urgentes ? "danger" : "neutral"} />
      </div>
    </div>
  );
}
