import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime, fullName, toDateInput, toTimeInput } from "@/lib/format";
import { HOUSE_STATUS, VISIT_KIND, VISIT_STATUS } from "@/lib/labels";
import type { HouseStatus, ObservationRow, PhotoRow, VisitItemRow, VisitRow, VisitSummary } from "@/lib/types";
import { Badge, Card, Dot, Notice, PageHeader } from "@/components/ui/primitives";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ActionButton, ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { VisitInProgress } from "@/components/visite/visit-in-progress";
import { VisitReport } from "@/components/visite/visit-report";
import { cancelVisit, rescheduleVisit, sendDebrief, startVisit, updateVisitComment } from "@/app/actions/visites";

export default async function VisitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string; terminee?: string }> }) {
  const { id } = await params;
  const { erreur, terminee } = await searchParams;
  const { supabase } = await requireStaff();

  const { data: visit } = await supabase
    .from("visits")
    .select("*, properties(id, name, commune, address, status, property_owners(clients(first_name, last_name, phone, user_id)))")
    .eq("id", id)
    .maybeSingle<VisitRow & { properties: { id: string; name: string; commune: string | null; address: string | null; status: HouseStatus; property_owners: { clients: { first_name: string; last_name: string; phone: string | null; user_id: string | null } | null }[] } | null }>();
  if (!visit || !visit.properties) notFound();
  const property = visit.properties;

  const [itemsRes, obsRes, photosRes, summaryRes] = await Promise.all([
    supabase.from("visit_checklist_items").select("*").eq("visit_id", id).order("position").returns<VisitItemRow[]>(),
    supabase.from("observations").select("*").eq("visit_id", id).order("created_at").returns<ObservationRow[]>(),
    supabase.from("photos").select("*").eq("visit_id", id).order("taken_at").returns<PhotoRow[]>(),
    visit.status === "terminee" ? supabase.rpc("visit_summary", { p_visit_id: id }) : Promise.resolve({ data: null }),
  ]);
  const items = itemsRes.data ?? [];
  const observations = obsRes.data ?? [];
  const photos = photosRes.data ?? [];
  const vs = VISIT_STATUS[visit.status];
  const owners = property.property_owners.map((o) => o.clients).filter(Boolean);
  const hasClientAccess = owners.some((c) => c?.user_id);

  return (
    <div className="animate-fade-up">
      <PageHeader
        back={{ href: `/admin/proprietes/${property.id}`, label: property.name }}
        eyebrow={`${VISIT_KIND[visit.kind]} · ${formatDate(visit.scheduled_at, { weekday: true })} ${visit.status === "planifiee" ? "à " + formatTime(visit.scheduled_at) : ""}`}
        title={
          <span className="flex items-center gap-3 flex-wrap">
            {property.name}
            <Badge tone={vs.tone} className="text-[14px]">{vs.label}</Badge>
          </span>
        }
        subtitle={
          <>
            {[property.address, property.commune].filter(Boolean).join(", ")}
            {owners.length > 0 && <> · {owners.map((c) => `${fullName(c)}${c?.phone ? ` (${c.phone})` : ""}`).join(", ")}</>}
          </>
        }
        actions={
          visit.status === "terminee" ? (
            <>
              <a href={`/api/rapports/visite/${visit.id}`} className={buttonClass("outline")} target="_blank" rel="noopener">
                <Icon name="download" size={18} /> Rapport PDF
              </a>
              {!visit.debrief_sent_at && (
                <ActionButton action={sendDebrief.bind(null, visit.id)} variant="bronze" icon="send" confirm={hasClientAccess ? "Envoyer le débrief au propriétaire ? Les observations et photos partageables deviendront visibles dans son espace." : "Le propriétaire n’a pas encore d’accès à l’application : le débrief sera visible dès que son accès sera créé. Continuer ?"}>
                  Envoyer le débrief au propriétaire
                </ActionButton>
              )}
            </>
          ) : null
        }
      />

      {erreur && <Notice tone="danger" className="mb-5">{erreur}</Notice>}
      {terminee && !visit.debrief_sent_at && (
        <Notice tone="ok" className="mb-5">
          Visite terminée. Relisez le résumé ci-dessous puis <strong>envoyez le débrief au propriétaire</strong>.
        </Notice>
      )}
      {visit.debrief_sent_at && (
        <Notice tone="ok" className="mb-5 flex items-center gap-2">
          <Icon name="check" size={18} /> Débrief envoyé le {formatDateTime(visit.debrief_sent_at)}. Le propriétaire a été notifié.
        </Notice>
      )}

      {visit.status === "planifiee" && (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
          <Card className="flex flex-col items-start gap-4">
            <div>
              <p className="text-[13px] text-ink-500">Prévue le</p>
              <p className="font-serif text-[26px] text-forest-900">{formatDateTime(visit.scheduled_at)}</p>
              <p className="text-[14px] text-ink-500 mt-1 flex items-center gap-2">
                Maison actuellement <Badge tone={HOUSE_STATUS[property.status].tone}><Dot tone={HOUSE_STATUS[property.status].tone} /> {HOUSE_STATUS[property.status].label}</Badge>
              </p>
            </div>
            <form action={startVisit.bind(null, visit.id)} className="w-full">
              <button className={buttonClass("primary", "xl", "w-full")}>
                <Icon name="play" size={22} /> Démarrer la visite
              </button>
            </form>
            <p className="text-[13px] text-ink-500">La date, l’heure, votre nom et la checklist de la maison seront enregistrés automatiquement.</p>
          </Card>
          <Card>
            <p className="font-medium text-forest-900 mb-3">Déplacer ou annuler</p>
            <ActionForm action={rescheduleVisit}>
              <input type="hidden" name="visit_id" value={visit.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" name="date" type="date" defaultValue={toDateInput(visit.scheduled_at)} required />
                <Field label="Heure" name="time" type="time" defaultValue={toTimeInput(visit.scheduled_at)} />
              </div>
              <Select label="Type de visite" name="kind" defaultValue={visit.kind}>
                {Object.entries(VISIT_KIND).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap gap-2">
                <SubmitButton full={false} size="md" variant="secondary" icon="calendar">Enregistrer</SubmitButton>
              </div>
            </ActionForm>
            <div className="mt-3">
              <ActionButton action={cancelVisit.bind(null, visit.id)} variant="ghost" icon="x" confirm="Annuler cette visite ?" redirectTo={`/admin/proprietes/${property.id}`}>
                Annuler la visite
              </ActionButton>
            </div>
          </Card>
        </div>
      )}

      {visit.status === "en_cours" && (
        <>
          <p className="text-[14px] text-ink-500 mb-4 flex items-center gap-2">
            <Icon name="clock" size={16} /> Commencée à {formatTime(visit.started_at)}
            {visit.intendant_name ? ` par ${visit.intendant_name}` : ""}
          </p>
          <VisitInProgress visitId={visit.id} propertyId={property.id} items={items} observations={observations} photos={photos} />
        </>
      )}

      {visit.status === "terminee" && (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
          <VisitReport visit={visit} items={items} observations={observations} photos={photos} summary={summaryRes.data as VisitSummary | null} staff observationHref={(oid) => `/admin/observations/${oid}`} />
          <div className="space-y-6">
            <Card>
              <p className="font-medium text-forest-900 mb-3">Ajuster le débrief</p>
              <ActionForm action={updateVisitComment}>
                <input type="hidden" name="visit_id" value={visit.id} />
                <Select label="État général" name="general_status" defaultValue={visit.general_status ?? "bon"}>
                  {Object.entries(HOUSE_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.emoji} {v.label}
                    </option>
                  ))}
                </Select>
                <TextArea label="Commentaire de l’intendant" name="comment" rows={5} defaultValue={visit.intendant_comment ?? ""} />
                <SubmitButton full={false} size="md" variant="secondary" icon="check">Enregistrer</SubmitButton>
              </ActionForm>
              <p className="text-[13px] text-ink-500 mt-3">L’état général modifié ici n’affecte pas la pastille actuelle de la maison (fixée en fin de visite).</p>
            </Card>
            <Card>
              <p className="font-medium text-forest-900 mb-2">Et ensuite ?</p>
              <ul className="text-[15px] space-y-2 text-ink-700">
                <li>
                  <Link href={`/admin/interventions/nouvelle?propriete=${property.id}`} className="text-forest-700 hover:underline">Créer une intervention</Link> si un artisan doit passer.
                </li>
                <li>
                  <Link href={`/admin/proprietes/${property.id}`} className="text-forest-700 hover:underline">Retour à la fiche propriété</Link>.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {visit.status === "annulee" && (
        <Card className="text-ink-500">
          Cette visite a été annulée. <LinkButton href={`/admin/visites/nouvelle?propriete=${property.id}`} variant="ghost" size="sm">Planifier une nouvelle visite</LinkButton>
        </Card>
      )}
    </div>
  );
}
