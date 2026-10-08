import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { INTERVENTION_STATUS } from "@/lib/labels";
import type { InterventionRow, PartnerRow } from "@/lib/types";
import { Badge, Card, List, PageHeader, Row, SectionTitle } from "@/components/ui/primitives";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { PartnerFields } from "@/components/admin/partner-form";
import { deletePartner, updatePartner } from "@/app/actions/partenaires";

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: partner } = await supabase.from("partners").select("*").eq("id", id).maybeSingle<PartnerRow>();
  if (!partner) notFound();
  const { data: interventions } = await supabase.from("interventions").select("*, properties(name)").eq("partner_id", id).order("created_at", { ascending: false }).limit(10).returns<(InterventionRow & { properties: { name: string } | null })[]>();
  return (
    <div className="animate-fade-up">
      <PageHeader
        back={{ href: "/admin/partenaires", label: "Partenaires" }}
        eyebrow={partner.trade}
        title={partner.company}
        subtitle={[partner.contact_name, partner.zone].filter(Boolean).join(" · ")}
        actions={
          <>
            {partner.phone && (
              <a href={`tel:${partner.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-xl bg-forest-50 text-forest-800 px-4 min-h-[44px] font-medium">
                <Icon name="phone" size={18} /> {partner.phone}
              </a>
            )}
          </>
        }
      />
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <ActionForm action={updatePartner}>
          <input type="hidden" name="partner_id" value={partner.id} />
          <Card>
            <PartnerFields partner={partner} />
          </Card>
          <div className="flex flex-wrap gap-2">
            <SubmitButton full={false} size="md" icon="check">Enregistrer</SubmitButton>
          </div>
        </ActionForm>
        <div className="space-y-6">
          <section>
            <SectionTitle>Interventions confiées</SectionTitle>
            {interventions?.length ? (
              <List>
                {interventions.map((i) => (
                  <Row key={i.id} href={`/admin/interventions/${i.id}`} title={`${i.properties?.name ?? ""} · ${i.title}`} subtitle={i.scheduled_at ? formatDateTime(i.scheduled_at) : "Date à fixer"} right={<Badge tone={INTERVENTION_STATUS[i.status].tone}>{INTERVENTION_STATUS[i.status].label}</Badge>} />
                ))}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucune intervention pour l’instant.</Card>
            )}
          </section>
          <Card>
            <ActionButton action={deletePartner.bind(null, partner.id)} variant="ghost" icon="trash" confirm="Supprimer ce partenaire ? Les interventions passées garderont son nom.">
              Supprimer le partenaire
            </ActionButton>
          </Card>
        </div>
      </div>
    </div>
  );
}
