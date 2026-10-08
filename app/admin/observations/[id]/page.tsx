import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { OBS_LEVEL, OBS_STATUS_STAFF } from "@/lib/labels";
import type { InterventionRow, ObservationRow, PhotoRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { ActionButton, ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { PhotoGrid } from "@/components/photos";
import { PhotoUploader } from "@/components/uploads/photo-uploader";
import { decideObservationAsStaff, deleteObservation, updateObservation } from "@/app/actions/visites";
import { INTERVENTION_STATUS } from "@/lib/labels";

export default async function ObservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: o } = await supabase.from("observations").select("*, properties(id, name)").eq("id", id).maybeSingle<ObservationRow & { properties: { id: string; name: string } | null }>();
  if (!o) notFound();
  const [{ data: photos }, { data: interventions }] = await Promise.all([
    supabase.from("photos").select("*").eq("observation_id", id).order("taken_at").returns<PhotoRow[]>(),
    supabase.from("interventions").select("*").eq("observation_id", id).order("created_at", { ascending: false }).returns<InterventionRow[]>(),
  ]);
  const level = OBS_LEVEL[o.level];

  return (
    <div className="animate-fade-up">
      <PageHeader
        back={o.visit_id ? { href: `/admin/visites/${o.visit_id}`, label: "Visite" } : { href: `/admin/proprietes/${o.property_id}`, label: o.properties?.name ?? "Propriété" }}
        eyebrow={`${level.emoji} ${level.label} · ${o.properties?.name ?? ""}`}
        title={o.title}
        subtitle={`Constatée le ${formatDateTime(o.observed_at)}`}
        actions={
          !interventions?.length && (o.level === "intervention_recommandee" || o.level === "urgent") ? (
            <LinkButton href={`/admin/interventions/nouvelle?propriete=${o.property_id}&observation=${o.id}`} icon="wrench">
              Créer l’intervention
            </LinkButton>
          ) : null
        }
      />

      {o.status === "en_attente_client" && (
        <Notice tone="warn" className="mb-5">
          <p className="font-medium mb-2">En attente de la décision du propriétaire.</p>
          <p className="text-[14px] mb-3">Si vous l’avez eu au téléphone, enregistrez sa réponse ici :</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton action={decideObservationAsStaff.bind(null, o.id, "autorise")} size="sm" variant="primary" icon="check">Il autorise l’intervention</ActionButton>
            <ActionButton action={decideObservationAsStaff.bind(null, o.id, "contacter_avant")} size="sm" variant="secondary" icon="phone">Il veut être recontacté</ActionButton>
            <ActionButton action={decideObservationAsStaff.bind(null, o.id, "client_gere")} size="sm" variant="ghost" icon="user">Il s’en occupe lui-même</ActionButton>
          </div>
        </Notice>
      )}
      {o.client_decision && (
        <p className="mb-5 text-[14px] text-ink-500">
          Décision du propriétaire : <strong>{o.client_decision === "autorise" ? "intervention autorisée" : o.client_decision === "contacter_avant" ? "souhaite être contacté avant" : "s’en occupe lui-même"}</strong> le {formatDateTime(o.client_decision_at)}.
        </p>
      )}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="space-y-6">
          <Card>
            <ActionForm action={updateObservation}>
              <input type="hidden" name="observation_id" value={o.id} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Select label="Niveau" name="level" defaultValue={o.level}>
                  {Object.entries(OBS_LEVEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.emoji} {v.label}
                    </option>
                  ))}
                </Select>
                <Select label="Statut" name="status" defaultValue={o.status}>
                  {Object.entries(OBS_STATUS_STAFF).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <Field label="Titre" name="title" required defaultValue={o.title} />
              <TextArea label="Description" name="description" defaultValue={o.description ?? ""} />
              <TextArea label="Action recommandée" name="recommended_action" rows={2} defaultValue={o.recommended_action ?? ""} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Coût estimatif min (€)" name="estimate_min" type="text" inputMode="decimal" defaultValue={o.estimate_min ?? ""} />
                <Field label="Coût estimatif max (€)" name="estimate_max" type="text" inputMode="decimal" defaultValue={o.estimate_max ?? ""} />
              </div>
              <Checkbox name="is_shared" label="Visible par le propriétaire" defaultChecked={o.is_shared} hint="Automatique à l’envoi du débrief ; immédiat pour une urgence." />
              <SubmitButton full={false} size="md" icon="check">Enregistrer</SubmitButton>
            </ActionForm>
          </Card>

          <section>
            <SectionTitle>Photos</SectionTitle>
            <PhotoGrid photos={photos ?? []} staff />
            <div className="mt-3">
              <PhotoUploader propertyId={o.property_id} visitId={o.visit_id} observationId={o.id} compact />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle>Interventions liées</SectionTitle>
            {interventions?.length ? (
              <Card className="space-y-3">
                {interventions.map((i) => (
                  <Link key={i.id} href={`/admin/interventions/${i.id}`} className="block">
                    <p className="font-medium text-forest-900 hover:underline">{i.title}</p>
                    <p className="text-[13px] text-ink-500">
                      {i.partner_name ?? "Artisan à choisir"} · <Badge tone={INTERVENTION_STATUS[i.status].tone}>{INTERVENTION_STATUS[i.status].label}</Badge>
                    </p>
                  </Link>
                ))}
              </Card>
            ) : (
              <Card className="text-[15px] text-ink-500">
                Aucune intervention. <Link href={`/admin/interventions/nouvelle?propriete=${o.property_id}&observation=${o.id}`} className="text-forest-700 hover:underline">En créer une</Link>.
              </Card>
            )}
          </section>
          <Card>
            <ActionButton action={deleteObservation.bind(null, o.id)} variant="ghost" icon="trash" confirm="Supprimer définitivement cette observation ?" redirectTo={o.visit_id ? `/admin/visites/${o.visit_id}` : `/admin/proprietes/${o.property_id}`}>
              Supprimer l’observation
            </ActionButton>
          </Card>
        </div>
      </div>
    </div>
  );
}
