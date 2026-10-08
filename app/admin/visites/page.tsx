import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { HOUSE_STATUS, VISIT_KIND, VISIT_STATUS } from "@/lib/labels";
import type { VisitRow, VisitStatus } from "@/lib/types";
import { Badge, EmptyState, List, PageHeader, Row } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Visites" };

const TABS: { key: string; label: string; statuses: VisitStatus[] }[] = [
  { key: "a_venir", label: "À venir", statuses: ["planifiee", "en_cours"] },
  { key: "terminees", label: "Terminées", statuses: ["terminee"] },
  { key: "annulees", label: "Annulées", statuses: ["annulee"] },
];

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ onglet?: string; propriete?: string }> }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0];
  let query = supabase
    .from("visits")
    .select("*, properties(id, name, commune)")
    .in("status", tab.statuses)
    .order("scheduled_at", { ascending: tab.key === "a_venir" })
    .limit(100);
  if (sp.propriete) query = query.eq("property_id", sp.propriete);
  const { data } = await query;
  const visits = (data ?? []) as unknown as (VisitRow & { properties: { id: string; name: string; commune: string | null } | null })[];
  const propertyName = sp.propriete ? visits[0]?.properties?.name : null;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Visites" subtitle={propertyName ? `Propriété : ${propertyName}` : "Toutes les visites, passées et à venir."} actions={<LinkButton href={`/admin/visites/nouvelle${sp.propriete ? `?propriete=${sp.propriete}` : ""}`} icon="plus">Planifier une visite</LinkButton>} />
      <div className="flex rounded-xl bg-stone-100 p-1 mb-5 text-[14px] font-medium w-fit">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/visites?onglet=${t.key}${sp.propriete ? `&propriete=${sp.propriete}` : ""}`} className={`px-4 py-2 rounded-lg ${tab.key === t.key ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {sp.propriete && (
        <p className="mb-4 text-[14px]">
          <Link href={`/admin/visites?onglet=${tab.key}`} className="text-forest-700 hover:underline">← Toutes les propriétés</Link>
        </p>
      )}
      {visits.length === 0 ? (
        <EmptyState icon="key" title="Aucune visite dans cette catégorie" />
      ) : (
        <List>
          {visits.map((v) => {
            const vs = VISIT_STATUS[v.status];
            return (
              <Row
                key={v.id}
                href={`/admin/visites/${v.id}`}
                tone={v.general_status ? HOUSE_STATUS[v.general_status].tone : vs.tone}
                title={`${v.properties?.name ?? ""} · ${VISIT_KIND[v.kind]}`}
                subtitle={v.status === "terminee" ? `${formatDateTime(v.ended_at)} · ${v.intendant_name ?? ""}${v.debrief_sent_at ? " · débrief envoyé" : " · débrief non envoyé"}` : `${formatDateTime(v.scheduled_at)} · ${v.properties?.commune ?? ""}`}
                right={<Badge tone={vs.tone}>{vs.label}</Badge>}
              />
            );
          })}
        </List>
      )}
      {visits.length === 100 && <p className="mt-3 text-[13px] text-ink-400">Seules les 100 visites les plus récentes sont affichées ; filtrez par propriété ({formatDate(new Date())}).</p>}
    </div>
  );
}
