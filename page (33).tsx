import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { INTERVENTION_STATUS } from "@/lib/labels";
import type { InterventionRow } from "@/lib/types";
import { Badge, EmptyState, List, PageHeader, Row } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Interventions" };

export default async function InterventionsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { supabase } = await requireStaff();
  const { onglet } = await searchParams;
  const closed = onglet === "terminees";
  const { data } = await supabase
    .from("interventions")
    .select("*, properties(name)")
    .in("status", closed ? ["terminee", "annulee"] : ["a_planifier", "artisan_contacte", "rdv_confirme", "en_cours"])
    .order(closed ? "completed_at" : "scheduled_at", { ascending: !closed, nullsFirst: !closed })
    .limit(100);
  const list = (data ?? []) as unknown as (InterventionRow & { properties: { name: string } | null })[];
  return (
    <div className="animate-fade-up">
      <PageHeader title="Interventions" subtitle="Travaux et passages d’artisans, de la demande à la facture." actions={<LinkButton href="/admin/interventions/nouvelle" icon="plus">Nouvelle intervention</LinkButton>} />
      <div className="flex rounded-xl bg-stone-100 p-1 mb-5 text-[14px] font-medium w-fit">
        <Link href="/admin/interventions" className={`px-4 py-2 rounded-lg ${!closed ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>En cours</Link>
        <Link href="/admin/interventions?onglet=terminees" className={`px-4 py-2 rounded-lg ${closed ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>Terminées</Link>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="wrench" title={closed ? "Aucune intervention terminée" : "Aucune intervention en cours"} />
      ) : (
        <List>
          {list.map((i) => (
            <Row
              key={i.id}
              href={`/admin/interventions/${i.id}`}
              icon={<Icon name="wrench" size={20} />}
              title={`${i.properties?.name ?? ""} · ${i.title}`}
              subtitle={`${i.partner_name ?? "Artisan à choisir"}${i.scheduled_at ? ` · ${formatDateTime(i.scheduled_at)}` : ""}${i.completed_at && closed ? ` · terminée le ${formatDateTime(i.completed_at)}` : ""}`}
              right={<Badge tone={INTERVENTION_STATUS[i.status].tone}>{INTERVENTION_STATUS[i.status].label}</Badge>}
            />
          ))}
        </List>
      )}
    </div>
  );
}
