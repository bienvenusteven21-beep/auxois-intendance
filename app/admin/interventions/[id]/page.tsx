import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { formatDateTime, formatMoney, toDateInput, toTimeInput } from "@/lib/format";
import { INTERVENTION_STATUS, OBS_LEVEL } from "@/lib/labels";
import type { InterventionRow, InterventionStatus, ObservationRow, PartnerRow, PhotoRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionButton, ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { PhotoGrid } from "@/components/photos";
import { PhotoUploader } from "@/components/uploads/photo-uploader";
import { DocumentList, type DocumentWithCategory } from "@/components/documents";
import { DocumentUploader } from "@/components/uploads/document-uploader";
import { setInterventionStatus, updateIntervention } from "@/app/actions/interventions";
import { Icon } from "@/components/ui/icon";

const FLOW: InterventionStatus[] = ["a_planifier", "artisan_contacte", "rdv_confirme", "en_cours", "terminee"];

export default async function InterventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: i } = await supabase.from("interventions").select("*, properties(id, name), partners(*)").eq("id", id).maybeSingle<InterventionRow & { properties: { id: string; name: string } | null; partners: PartnerRow | null }>();
  if (!i) notFound();
  const [{ data: partners }, obsRes, { data: photos }, { data: docs }, { data: cats }] = await Promise.all([
    supabase.from("partners").select("*").eq("is_active", true).order("trade").order("company").returns<PartnerRow[]>(),
    i.observation_id ? supabase.from("observations").select("*").eq("id", i.observation_id).maybeSingle<ObservationRow>() : Promise.resolve({ data: null }),
    supabase.from("photos").select("*").eq("intervention_id", id).order("taken_at").returns<PhotoRow[]>(),
    supabase.from("documents").select("*, document_categories(name)").eq("intervention_id", id).order("created_at", { ascending: false }).returns<DocumentWithCategory[]>(),
    supabase.from("document_categories").select("id, name").order("position"),
  ]);
  const st = INTERVENTION_STATUS[i.status];
  const stepIndex = FLOW.indexOf(i.status);
  const next = stepIndex >= 0 && stepIndex < FLOW.length - 1 ? FLOW[stepIndex + 1] : null;
  const before = (photos ?? []).filter((p) => p.phase === "avant");
  const after = (photos ?? []).filter((p) => p.phase === "apres");
  const other = (photos ?? []).filter((p) => !p.phase);

  return (
    <div className="animate-fade-up">
      <PageHeader
        back={{ href: "/admin/interventions", label: "Interventions" }}
        eyebrow={i.properties?.name}
        title={
          <span className="flex items-center gap-3 flex-wrap">
            {i.title} <Badge tone={st.tone} className="text-[14px]">{st.label}</Badge>
          </span>
        }
        subtitle={`${i.partner_name ?? "Artisan à choisir"}${i.scheduled_at ? ` · ${formatDateTime(i.scheduled_at)}` : ""}`}
        actions={
          next && i.status !== "terminee" ? (
            <ActionButton action={setInterventionStatus.bind(null, i.id, next)} variant={next === "terminee" ? "bronze" : "primary"} icon={next === "terminee" ? "check" : "arrowRight"} confirm={next === "terminee" ? "Marquer l’intervention terminée ? Le propriétaire sera notifié et l’observation liée passera en « résolu »." : undefined}>
              Passer à « {INTERVENTION_STATUS[next].label} »
            </ActionButton>
          ) : null
        }
      />

      {/* Frise d’avancement */}
      <ol className="flex items-center gap-1 mb-6 text-[12px] overflow-x-auto no-scrollbar">
        {FLOW.map((s, idx) => (
          <li key={s} className={`flex items-center gap-1 shrink-0 ${idx <= stepIndex ? "text-forest-800" : "text-ink-300"}`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center ${idx < stepIndex ? "bg-forest-800 text-cream" : idx === stepIndex ? "bg-bronze-500 text-white" : "bg-stone-200"}`}>
              {idx < stepIndex ? <Icon name="check" size={14} strokeWidth={2.5} /> : idx + 1}
            </span>
            <span className="whitespace-nowrap">{INTERVENTION_STATUS[s].label}</span>
            {idx < FLOW.length - 1 && <span className="w-4 h-px bg-stone-300 mx-1" />}
          </li>
        ))}
      </ol>

      {obsRes.data && (
        <Notice tone="info" className="mb-6">
          Observation d’origine : <Link href={`/admin/observations/${obsRes.data.id}`} className="underline">{OBS_LEVEL[obsRes.data.level].emoji} {obsRes.data.title}</Link>
          {obsRes.data.client_decision === "autorise" && <> · autorisée par le propriétaire le {formatDateTime(obsRes.data.client_decision_at)}</>}
        </Notice>
      )}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="space-y-6">
          <Card>
            <ActionForm action={updateIntervention}>
              <input type="hidden" name="intervention_id" value={i.id} />
              <Field label="Problème / intitulé" name="title" required defaultValue={i.title} />
              <TextArea label="Description" name="description" defaultValue={i.description ?? ""} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Select label="Artisan" name="partner_id" defaultValue={i.partner_id ?? ""}>
                  <option value="">— À choisir —</option>
                  {(partners ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company} ({p.trade})
                    </option>
                  ))}
                </Select>
                <Select label="Statut" name="status" defaultValue={i.status}>
                  {Object.entries(INTERVENTION_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
                <Field label="Date prévue" name="date" type="date" defaultValue={toDateInput(i.scheduled_at)} />
                <Field label="Heure" name="time" type="time" defaultValue={toTimeInput(i.scheduled_at) || "09:00"} />
              </div>
              <TextArea label="Compte rendu" name="report" rows={4} defaultValue={i.report ?? ""} placeholder="Ce qui a été fait, pièces remplacées, recommandations…" />
              <Field label="Coût final (€)" name="final_cost" type="text" inputMode="decimal" defaultValue={i.final_cost ?? ""} />
              <SubmitButton full={false} size="md" icon="check">Enregistrer</SubmitButton>
            </ActionForm>
          </Card>

          <section>
            <SectionTitle>Photos avant</SectionTitle>
            <PhotoGrid photos={before} staff />
            <div className="mt-3"><PhotoUploader propertyId={i.property_id} interventionId={i.id} observationId={i.observation_id} phase="avant" compact /></div>
          </section>
          <section>
            <SectionTitle>Photos après</SectionTitle>
            <PhotoGrid photos={after} staff />
            <div className="mt-3"><PhotoUploader propertyId={i.property_id} interventionId={i.id} observationId={i.observation_id} phase="apres" compact /></div>
          </section>
          {other.length > 0 && (
            <section>
              <SectionTitle>Autres photos</SectionTitle>
              <PhotoGrid photos={other} staff />
            </section>
          )}
        </div>

        <div className="space-y-6">
          {i.partners && (
            <Card>
              <p className="text-[13px] uppercase tracking-[0.12em] text-ink-500 font-sans font-semibold mb-2">Artisan</p>
              <p className="font-medium text-forest-900">{i.partners.company}</p>
              <p className="text-[14px] text-ink-500">{i.partners.trade}{i.partners.contact_name ? ` · ${i.partners.contact_name}` : ""}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {i.partners.phone && <a href={`tel:${i.partners.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 rounded-xl bg-forest-50 text-forest-800 px-3 py-2 text-[14px]"><Icon name="phone" size={16} /> {i.partners.phone}</a>}
                {i.partners.email && <a href={`mailto:${i.partners.email}`} className="inline-flex items-center gap-1.5 rounded-xl bg-forest-50 text-forest-800 px-3 py-2 text-[14px]"><Icon name="mail" size={16} /> Email</a>}
              </div>
              <Link href={`/admin/partenaires/${i.partners.id}`} className="block mt-3 text-[14px] text-forest-700 hover:underline">Fiche partenaire</Link>
            </Card>
          )}
          {i.status === "terminee" && (
            <Card className="bg-ok-100 border-ok-600/20">
              <p className="font-medium text-ok-600 flex items-center gap-2"><Icon name="check" size={18} /> Terminée le {formatDateTime(i.completed_at)}</p>
              {i.final_cost != null && <p className="text-[15px] mt-1">Coût : {formatMoney(i.final_cost)}</p>}
            </Card>
          )}
          <section>
            <SectionTitle>Facture / documents</SectionTitle>
            <DocumentList documents={docs ?? []} staff />
            <div className="mt-3">
              <DocumentUploader propertyId={i.property_id} interventionId={i.id} categories={cats ?? []} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
