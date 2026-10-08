import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { formatDate, formatDateTime, formatMoney, fullName, todayParis } from "@/lib/format";
import { CARNET_FIELDS, HOUSE_STATUS, INTERVENTION_STATUS, TIMELINE_ICON, VISIT_KIND, VISIT_STATUS } from "@/lib/labels";
import type { ClientRow, InterventionRow, ObservationRow, PhotoRow, PlanRow, PropertyNoteRow, PropertyRow, SubscriptionRow, TimelineRow, VisitRow } from "@/lib/types";
import { Badge, Card, Dot, KeyValue, List, Notice, PageHeader, Row, SectionTitle } from "@/components/ui/primitives";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ActionButton, ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { SecretsPanel } from "@/components/admin/secrets-panel";
import { PhotoGrid } from "@/components/photos";
import { DocumentList, type DocumentWithCategory } from "@/components/documents";
import { DocumentUploader } from "@/components/uploads/document-uploader";
import { PhotoUploader } from "@/components/uploads/photo-uploader";
import { ObservationCard } from "@/components/observation-card";
import { addOwner, addPropertyNote, deletePropertyNote, removeOwner, saveSubscription, setCoverPhoto } from "@/app/actions/proprietes";
import { startUnplannedVisit, startVisit } from "@/app/actions/visites";

export default async function PropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { id } = await params;
  const { erreur } = await searchParams;
  const { supabase, profile } = await requireStaff();

  const { data: property } = await supabase.from("properties").select("*").eq("id", id).maybeSingle<PropertyRow>();
  if (!property) notFound();

  const [ownersRes, subRes, plansRes, clientsRes, visitsRes, obsRes, intRes, photosRes, docsRes, notesRes, catRes, timelineRes, tplRes] = await Promise.all([
    supabase.from("property_owners").select("client_id, is_primary, clients(*)").eq("property_id", id),
    supabase.from("subscriptions").select("*, subscription_plans(*)").eq("property_id", id).order("created_at", { ascending: false }),
    supabase.from("subscription_plans").select("*").order("position").returns<PlanRow[]>(),
    supabase.from("clients").select("*").eq("is_active", true).order("last_name").returns<ClientRow[]>(),
    supabase.from("visits").select("*").eq("property_id", id).order("scheduled_at", { ascending: false }).limit(12).returns<VisitRow[]>(),
    supabase.from("observations").select("*").eq("property_id", id).not("status", "in", '("resolu","classe_sans_suite")').order("observed_at", { ascending: false }).returns<ObservationRow[]>(),
    supabase.from("interventions").select("*").eq("property_id", id).order("created_at", { ascending: false }).limit(8).returns<InterventionRow[]>(),
    supabase.from("photos").select("*").eq("property_id", id).order("taken_at", { ascending: false }).limit(8).returns<PhotoRow[]>(),
    supabase.from("documents").select("*, document_categories(name)").eq("property_id", id).order("created_at", { ascending: false }).returns<DocumentWithCategory[]>(),
    supabase.from("property_notes").select("*").eq("property_id", id).order("created_at", { ascending: false }).returns<PropertyNoteRow[]>(),
    supabase.from("document_categories").select("id, name").order("position"),
    supabase.from("property_timeline").select("*").eq("property_id", id).order("happened_at", { ascending: false }).limit(6).returns<TimelineRow[]>(),
    supabase.from("checklist_templates").select("id").eq("property_id", id).maybeSingle(),
  ]);

  const owners = (ownersRes.data ?? []) as unknown as { client_id: string; is_primary: boolean; clients: ClientRow | null }[];
  const subscriptions = (subRes.data ?? []) as unknown as (SubscriptionRow & { subscription_plans: PlanRow | null })[];
  const active = subscriptions.find((s) => s.status === "actif");
  const plans = plansRes.data ?? [];
  const visits = visitsRes.data ?? [];
  const nextVisit = visits.filter((v) => v.status === "planifiee" && v.scheduled_at >= new Date().toISOString()).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const inProgress = visits.find((v) => v.status === "en_cours");
  const lastVisit = visits.filter((v) => v.status === "terminee").sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];
  const st = HOUSE_STATUS[property.status];
  const visitsPerYear = active?.visits_per_year_override ?? active?.subscription_plans?.visits_per_year;
  const canSeeSecrets = profile.role === "super_admin" || profile.role === "intendant";
  const availableClients = (clientsRes.data ?? []).filter((c) => !owners.some((o) => o.client_id === c.id));

  return (
    <div className="animate-fade-up">
      <PageHeader
        back={{ href: "/admin/proprietes", label: "Propriétés" }}
        eyebrow={property.commune ?? "Propriété"}
        title={
          <span className="flex items-center gap-3">
            {property.name}
            <Badge tone={st.tone} className="text-[14px]">
              <Dot tone={st.tone} /> {st.label}
            </Badge>
            {!property.is_active && <Badge>Inactive</Badge>}
          </span>
        }
        subtitle={[property.address, property.postal_code, property.commune].filter(Boolean).join(", ")}
        actions={
          <>
            {inProgress ? (
              <form action={startVisit.bind(null, inProgress.id)}>
                <button className={buttonClass("bronze")}>
                  <Icon name="play" size={18} /> Reprendre la visite en cours
                </button>
              </form>
            ) : nextVisit ? (
              <form action={startVisit.bind(null, nextVisit.id)}>
                <button className={buttonClass("primary")}>
                  <Icon name="play" size={18} /> Démarrer la visite du {formatDate(nextVisit.scheduled_at, { year: false })}
                </button>
              </form>
            ) : null}
            {!inProgress && (
              <form action={startUnplannedVisit.bind(null, property.id, "controle")}>
                <button className={buttonClass("outline")}>
                  <Icon name="key" size={18} /> Visite de contrôle maintenant
                </button>
              </form>
            )}
            <LinkButton href={`/admin/visites/nouvelle?propriete=${property.id}`} variant="outline" icon="calendar">
              Planifier
            </LinkButton>
            <LinkButton href={`/admin/proprietes/${property.id}/modifier`} variant="secondary" icon="edit">
              Modifier
            </LinkButton>
          </>
        }
      />
      {erreur && <Notice tone="danger" className="mb-5">{erreur}</Notice>}

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        <div className="space-y-6">
          {/* Résumé */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="!p-4">
              <p className="text-[13px] text-ink-500">Dernière visite</p>
              <p className="font-medium text-forest-900 mt-1">{lastVisit ? formatDateTime(lastVisit.ended_at) : "—"}</p>
              {lastVisit && <Link href={`/admin/visites/${lastVisit.id}`} className="text-[13px] text-forest-700 hover:underline">Voir le débrief</Link>}
            </Card>
            <Card className="!p-4">
              <p className="text-[13px] text-ink-500">Prochaine visite</p>
              <p className="font-medium text-forest-900 mt-1">{nextVisit ? formatDateTime(nextVisit.scheduled_at) : "À planifier"}</p>
              {nextVisit && <Link href={`/admin/visites/${nextVisit.id}`} className="text-[13px] text-forest-700 hover:underline">Détails</Link>}
            </Card>
            <Card className="!p-4">
              <p className="text-[13px] text-ink-500">Formule</p>
              <p className="font-medium text-forest-900 mt-1">{active?.subscription_plans?.name ?? "Sans formule"}</p>
              <p className="text-[13px] text-ink-500">{visitsPerYear ? `${visitsPerYear} visites / an` : ""}</p>
            </Card>
          </div>

          {/* Observations ouvertes */}
          <section>
            <SectionTitle action={<Link href={`/admin/observations?propriete=${property.id}`} className="text-[14px] text-forest-700 hover:underline">Toutes les observations</Link>}>
              Points ouverts ({obsRes.data?.length ?? 0})
            </SectionTitle>
            {obsRes.data?.length ? (
              <div className="space-y-3">
                {obsRes.data.map((o) => (
                  <ObservationCard key={o.id} o={o} href={`/admin/observations/${o.id}`} staff />
                ))}
              </div>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucun point ouvert. La maison va bien. 🟢</Card>
            )}
          </section>

          {/* Visites */}
          <section>
            <SectionTitle action={<Link href={`/admin/visites?propriete=${property.id}`} className="text-[14px] text-forest-700 hover:underline">Toutes les visites</Link>}>Visites</SectionTitle>
            <List>
              {visits.slice(0, 6).map((v) => {
                const vs = VISIT_STATUS[v.status];
                return (
                  <Row
                    key={v.id}
                    href={`/admin/visites/${v.id}`}
                    tone={v.general_status ? HOUSE_STATUS[v.general_status].tone : vs.tone}
                    title={`${VISIT_KIND[v.kind]} · ${formatDate(v.scheduled_at)}`}
                    subtitle={v.status === "terminee" ? `${v.intendant_name ?? ""} · ${v.debrief_sent_at ? "Débrief envoyé" : "Débrief non envoyé"}` : formatDateTime(v.scheduled_at)}
                    right={<Badge tone={vs.tone}>{vs.label}</Badge>}
                  />
                );
              })}
              {visits.length === 0 && <p className="px-4 py-4 text-ink-500 text-[15px]">Aucune visite.</p>}
            </List>
          </section>

          {/* Interventions */}
          <section>
            <SectionTitle action={<Link href={`/admin/interventions/nouvelle?propriete=${property.id}`} className="text-[14px] text-forest-700 hover:underline">+ Nouvelle intervention</Link>}>Interventions</SectionTitle>
            {intRes.data?.length ? (
              <List>
                {intRes.data.map((i) => {
                  const is = INTERVENTION_STATUS[i.status];
                  return <Row key={i.id} href={`/admin/interventions/${i.id}`} icon={<Icon name="wrench" size={20} />} title={i.title} subtitle={`${i.partner_name ?? "Artisan à choisir"}${i.scheduled_at ? ` · ${formatDateTime(i.scheduled_at)}` : ""}`} right={<Badge tone={is.tone}>{is.label}</Badge>} />;
                })}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucune intervention.</Card>
            )}
          </section>

          {/* Photos */}
          <section>
            <SectionTitle>Photos récentes</SectionTitle>
            <PhotoGrid photos={photosRes.data ?? []} staff />
            <div className="mt-3 space-y-3">
              <PhotoUploader propertyId={property.id} compact />
              {photosRes.data?.length ? (
                <form className="flex flex-wrap items-center gap-2 text-[13px] text-ink-500">
                  Photo de couverture :
                  {photosRes.data.slice(0, 6).map((p) => (
                    <ActionButton key={p.id} action={setCoverPhoto.bind(null, property.id, p.storage_path)} size="sm" variant={property.cover_photo_path === p.storage_path ? "primary" : "secondary"}>
                      {p.caption?.slice(0, 18) || p.category || "Photo"}
                    </ActionButton>
                  ))}
                </form>
              ) : null}
            </div>
          </section>

          {/* Documents */}
          <section>
            <SectionTitle>Documents</SectionTitle>
            <DocumentList documents={docsRes.data ?? []} staff />
            <div className="mt-3">
              <DocumentUploader propertyId={property.id} categories={catRes.data ?? []} />
            </div>
          </section>

          {/* Carnet Maison */}
          <section>
            <SectionTitle action={<Link href={`/admin/proprietes/${property.id}/modifier#carnet`} className="text-[14px] text-forest-700 hover:underline">Modifier</Link>}>Carnet Maison</SectionTitle>
            <Card>
              <KeyValue items={CARNET_FIELDS.map((f) => ({ label: f.label, value: property[f.key as keyof PropertyRow] as string | null }))} />
              {CARNET_FIELDS.every((f) => !property[f.key as keyof PropertyRow]) && <p className="text-ink-500 text-[15px]">Le carnet est vide pour l’instant.</p>}
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          {canSeeSecrets && <SecretsPanel propertyId={property.id} />}

          {/* Propriétaires */}
          <section>
            <SectionTitle>Propriétaires</SectionTitle>
            <Card className="space-y-3">
              {owners.map((o) => (
                <div key={o.client_id} className="flex items-center gap-3">
                  <Link href={`/admin/clients/${o.client_id}`} className="flex-1 min-w-0">
                    <p className="font-medium text-forest-900 truncate">
                      {fullName(o.clients)} {o.is_primary && <span className="text-[12px] text-bronze-600 font-normal">· principal</span>}
                    </p>
                    <p className="text-[13px] text-ink-500 truncate">{o.clients?.phone ?? ""} {o.clients?.email ? `· ${o.clients.email}` : ""}</p>
                    {!o.clients?.user_id && <p className="text-[12px] text-warn-600">Pas encore d’accès à l’application</p>}
                  </Link>
                  <ActionButton action={removeOwner.bind(null, property.id, o.client_id)} size="sm" variant="ghost" icon="x" confirm="Retirer ce propriétaire de la maison ?">
                    <span className="sr-only">Retirer</span>
                  </ActionButton>
                </div>
              ))}
              {owners.length === 0 && <p className="text-[15px] text-ink-500">Aucun propriétaire rattaché.</p>}
              {availableClients.length > 0 && (
                <ActionForm action={addOwner} className="pt-2 border-t border-stone-100">
                  <input type="hidden" name="property_id" value={property.id} />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select label="Ajouter un propriétaire" name="client_id">
                        {availableClients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.last_name} {c.first_name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="self-end">
                      <SubmitButton full={false} size="md" icon="plus">Ajouter</SubmitButton>
                    </div>
                  </div>
                </ActionForm>
              )}
            </Card>
          </section>

          {/* Abonnement */}
          <section>
            <SectionTitle>Abonnement</SectionTitle>
            <Card>
              {active && (
                <div className="mb-4 text-[15px]">
                  <p className="font-medium text-forest-900">{active.subscription_plans?.name}</p>
                  <p className="text-ink-500">
                    {formatMoney(active.monthly_price_override ?? active.subscription_plans?.monthly_price)} / mois · {visitsPerYear} visites / an
                  </p>
                  <p className="text-ink-500">Depuis le {formatDate(active.started_on)}{active.renewal_on ? ` · renouvellement le ${formatDate(active.renewal_on)}` : ""}</p>
                </div>
              )}
              <details>
                <summary className="cursor-pointer text-forest-700 text-[15px]">{active ? "Modifier l’abonnement" : "Choisir une formule"}</summary>
                <ActionForm action={saveSubscription} className="mt-3">
                  <input type="hidden" name="property_id" value={property.id} />
                  {active && <input type="hidden" name="subscription_id" value={active.id} />}
                  <Select label="Formule" name="plan_id" defaultValue={active?.plan_id ?? ""}>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.monthly_price} €/mois, {p.visits_per_year} visites/an
                      </option>
                    ))}
                  </Select>
                  <Select label="Statut" name="status" defaultValue={active?.status ?? "actif"}>
                    <option value="actif">Actif</option>
                    <option value="suspendu">Suspendu</option>
                    <option value="resilie">Résilié</option>
                  </Select>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Début" name="started_on" type="date" defaultValue={active?.started_on ?? todayParis()} />
                    <Field label="Renouvellement" name="renewal_on" type="date" defaultValue={active?.renewal_on ?? ""} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Visites/an (manuel)" name="visits_per_year_override" type="number" min={1} max={365} defaultValue={active?.visits_per_year_override ?? ""} hint="Vide = selon la formule" />
                    <Field label="Prix/mois (manuel)" name="monthly_price_override" type="text" inputMode="decimal" defaultValue={active?.monthly_price_override ?? ""} hint="Vide = selon la formule" />
                  </div>
                  <SubmitButton full={false} size="md" icon="check">Enregistrer</SubmitButton>
                </ActionForm>
              </details>
            </Card>
          </section>

          {/* Checklist */}
          <section>
            <SectionTitle>Checklist de visite</SectionTitle>
            <Card className="text-[15px]">
              <p className="text-ink-700">{tplRes.data ? "Checklist personnalisée pour cette maison." : "Checklist standard."}</p>
              <Link href={`/admin/proprietes/${property.id}/checklist`} className="text-forest-700 hover:underline">
                {tplRes.data ? "Modifier la checklist" : "Personnaliser (ex. ajouter une catégorie Piscine)"}
              </Link>
            </Card>
          </section>

          {/* Notes */}
          <section>
            <SectionTitle>Notes</SectionTitle>
            <Card className="space-y-3">
              {notesRes.data?.map((n) => (
                <div key={n.id} className="flex items-start gap-2 text-[15px]">
                  <Badge tone={n.visibility === "client" ? "ok" : "neutral"} className="shrink-0 mt-0.5">{n.visibility === "client" ? "Client" : "Interne"}</Badge>
                  <p className="flex-1 whitespace-pre-line text-ink-700">{n.body}</p>
                  <ActionButton action={deletePropertyNote.bind(null, n.id, property.id)} size="sm" variant="ghost" icon="x" confirm="Supprimer cette note ?">
                    <span className="sr-only">Supprimer</span>
                  </ActionButton>
                </div>
              ))}
              <ActionForm action={addPropertyNote} resetOnSuccess className={notesRes.data?.length ? "pt-3 border-t border-stone-100" : ""}>
                <input type="hidden" name="property_id" value={property.id} />
                <TextArea label="Nouvelle note" name="body" rows={2} required />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select label="Visibilité" name="visibility">
                      <option value="interne">Interne (équipe)</option>
                      <option value="client">Visible par le propriétaire</option>
                    </Select>
                  </div>
                  <SubmitButton full={false} size="md" icon="plus">Ajouter</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          </section>

          {/* Historique */}
          <section>
            <SectionTitle>Historique récent</SectionTitle>
            <Card>
              <ul className="space-y-2 text-[15px]">
                {(timelineRes.data ?? []).map((t) => (
                  <li key={`${t.kind}-${t.entity_id}`} className="flex gap-2">
                    <span>{TIMELINE_ICON[t.kind]}</span>
                    <span className="flex-1">
                      <span className="text-ink-500">{formatDate(t.happened_at, { year: false })} — </span>
                      {t.title}
                    </span>
                  </li>
                ))}
                {!timelineRes.data?.length && <li className="text-ink-500">Rien pour l’instant.</li>}
              </ul>
              {property.cover_photo_path && (
                <p className="mt-3 text-[13px] text-ink-400">
                  <a href={fileUrl("photos", property.cover_photo_path)} target="_blank" rel="noopener" className="hover:underline">Photo de couverture</a>
                </p>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
