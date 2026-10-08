import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { VISIT_KIND } from "@/lib/labels";
import type { ObservationRow, PhotoRow, VisitItemRow, VisitRow, VisitSummary } from "@/lib/types";
import { PageHeader } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { VisitReport } from "@/components/visite/visit-report";

export default async function ClientVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireClient();
  const { data: visit } = await supabase.from("visits").select("*, properties(name)").eq("id", id).maybeSingle<VisitRow & { properties: { name: string } | null }>();
  if (!visit || !visit.debrief_sent_at) notFound();
  const [{ data: items }, { data: observations }, { data: photos }, { data: summary }] = await Promise.all([
    supabase.from("visit_checklist_items").select("*").eq("visit_id", id).order("position").returns<VisitItemRow[]>(),
    supabase.from("observations").select("*").eq("visit_id", id).order("created_at").returns<ObservationRow[]>(),
    supabase.from("photos").select("*").eq("visit_id", id).order("taken_at").returns<PhotoRow[]>(),
    supabase.rpc("visit_summary", { p_visit_id: id }),
  ]);
  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader
        back={{ href: "/client/historique", label: "Historique" }}
        eyebrow={VISIT_KIND[visit.kind]}
        title={`Débrief du ${formatDate(visit.ended_at)}`}
        subtitle={visit.properties?.name}
        actions={
          <a href={`/api/rapports/visite/${visit.id}`} className={buttonClass("outline")} target="_blank" rel="noopener">
            <Icon name="download" size={18} /> Rapport PDF
          </a>
        }
      />
      <VisitReport visit={visit} items={items ?? []} observations={observations ?? []} photos={photos ?? []} summary={summary as VisitSummary | null} staff={false} observationHref={() => "/client/interventions"} />
    </div>
  );
}
