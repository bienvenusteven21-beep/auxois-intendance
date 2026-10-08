import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime, fullName } from "@/lib/format";
import { HOUSE_STATUS, REQUEST_STATUS, STAY_STATUS } from "@/lib/labels";
import type { ClientRequestRow, ClientRow, HouseStatus, StayRow } from "@/lib/types";
import { Badge, Card, Dot, List, Notice, PageHeader, Row, SectionTitle } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ActionButton, ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { ClientFields } from "@/components/admin/client-form";
import { DocumentList, type DocumentWithCategory } from "@/components/documents";
import { DocumentUploader } from "@/components/uploads/document-uploader";
import { createClientAccess, resetClientPassword, unlinkClientAccess, updateClientSheet } from "@/app/actions/clients";
import { activePlanName } from "@/lib/queries";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<ClientRow>();
  if (!client) notFound();

  const [notesRes, ownedRes, requestsRes, staysRes, docsRes, catRes, userRes] = await Promise.all([
    supabase.from("client_internal_notes").select("notes").eq("client_id", id).maybeSingle(),
    supabase.from("property_owners").select("is_primary, properties(id, name, commune, status, subscriptions(status, subscription_plans(name)))").eq("client_id", id),
    supabase.from("client_requests").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(6).returns<ClientRequestRow[]>(),
    supabase.from("stays").select("*").eq("client_id", id).order("arrival_date", { ascending: false }).limit(4).returns<StayRow[]>(),
    supabase.from("documents").select("*, document_categories(name)").eq("client_id", id).order("created_at", { ascending: false }).returns<DocumentWithCategory[]>(),
    supabase.from("document_categories").select("id, name").order("position"),
    client.user_id ? supabase.from("users").select("email, full_name, is_active, created_at").eq("id", client.user_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const owned = (ownedRes.data ?? []) as unknown as { is_primary: boolean; properties: { id: string; name: string; commune: string | null; status: HouseStatus; subscriptions: unknown } | null }[];

  return (
    <div className="animate-fade-up">
      <PageHeader
        back={{ href: "/admin/clients", label: "Clients" }}
        eyebrow={`Client depuis le ${formatDate(client.created_at)}`}
        title={
          <span className="flex items-center gap-3">
            {fullName(client)} {!client.is_active && <Badge>Inactif</Badge>}
          </span>
        }
        subtitle={[client.phone, client.email].filter(Boolean).join(" · ")}
        actions={<LinkButton href={`/admin/proprietes/nouvelle?client=${client.id}`} variant="outline" icon="plus">Ajouter une propriété</LinkButton>}
      />

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6">
          <section>
            <SectionTitle>Propriétés</SectionTitle>
            {owned.length ? (
              <List>
                {owned.map((o) =>
                  o.properties ? (
                    <Row
                      key={o.properties.id}
                      href={`/admin/proprietes/${o.properties.id}`}
                      tone={HOUSE_STATUS[o.properties.status].tone}
                      title={o.properties.name}
                      subtitle={`${o.properties.commune ?? ""}${activePlanName(o.properties) ? ` · Formule ${activePlanName(o.properties)}` : ""}${o.is_primary ? " · propriétaire principal" : ""}`}
                      right={<Badge tone={HOUSE_STATUS[o.properties.status].tone}><Dot tone={HOUSE_STATUS[o.properties.status].tone} /> {HOUSE_STATUS[o.properties.status].label}</Badge>}
                    />
                  ) : null,
                )}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucune propriété rattachée. Créez une propriété ou rattachez ce client depuis une fiche propriété.</Card>
            )}
          </section>

          <section>
            <SectionTitle>Fiche client</SectionTitle>
            <ActionForm action={updateClientSheet}>
              <input type="hidden" name="client_id" value={client.id} />
              <Card>
                <ClientFields client={client} notes={notesRes.data?.notes ?? ""} />
              </Card>
              <SubmitButton full={false} size="md" icon="check">Enregistrer la fiche</SubmitButton>
            </ActionForm>
          </section>

          <section>
            <SectionTitle>Documents du client</SectionTitle>
            <DocumentList documents={docsRes.data ?? []} staff />
            <div className="mt-3">
              <DocumentUploader clientId={client.id} categories={catRes.data ?? []} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle>Accès à l’application</SectionTitle>
            <Card>
              {client.user_id ? (
                <div className="space-y-3 text-[15px]">
                  <p className="flex items-center gap-2 text-ok-600 font-medium">
                    <Icon name="check" size={18} /> Accès actif
                  </p>
                  <p className="text-ink-700">
                    Identifiant : <strong>{userRes.data?.email ?? client.email}</strong>
                  </p>
                  {userRes.data && !userRes.data.is_active && <Notice tone="warn">Ce compte est désactivé (voir Paramètres → Utilisateurs).</Notice>}
                  <div className="flex flex-wrap gap-2">
                    <ActionButton action={resetClientPassword.bind(null, client.id)} size="sm" variant="secondary" icon="refresh" confirm="Générer un nouveau mot de passe provisoire pour ce client ?">
                      Nouveau mot de passe provisoire
                    </ActionButton>
                    <ActionButton action={unlinkClientAccess.bind(null, client.id)} size="sm" variant="ghost" icon="x" confirm="Retirer l’accès ? Le client ne verra plus ses propriétés.">
                      Retirer l’accès
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <ActionForm action={createClientAccess}>
                  <input type="hidden" name="client_id" value={client.id} />
                  <p className="text-[15px] text-ink-700">Ce client n’a pas encore d’accès à son espace. Créez-lui un compte : un mot de passe provisoire vous sera affiché.</p>
                  <Field label="Email de connexion" name="email" type="email" required defaultValue={client.email ?? ""} />
                  <input type="hidden" name="phone" value={client.phone ?? ""} />
                  <SubmitButton size="md" icon="key">Créer l’accès</SubmitButton>
                  <p className="text-[13px] text-ink-500">Si le client s’est déjà inscrit lui-même avec cette adresse, son compte sera simplement relié à cette fiche.</p>
                </ActionForm>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle action={<Link href="/admin/demandes" className="text-[14px] text-forest-700 hover:underline">Toutes</Link>}>Demandes</SectionTitle>
            {requestsRes.data?.length ? (
              <List>
                {requestsRes.data.map((r) => (
                  <Row key={r.id} href={`/admin/demandes/${r.id}`} title={r.subject} subtitle={formatDateTime(r.created_at)} right={<Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>} />
                ))}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucune demande.</Card>
            )}
          </section>

          <section>
            <SectionTitle>Séjours</SectionTitle>
            {staysRes.data?.length ? (
              <List>
                {staysRes.data.map((s) => (
                  <Row key={s.id} icon={<Icon name="house" size={20} />} title={`Du ${formatDate(s.arrival_date, { year: false })} au ${formatDate(s.departure_date)}`} subtitle={s.options.join(", ") || s.message || ""} right={<Badge tone={STAY_STATUS[s.status].tone}>{STAY_STATUS[s.status].label}</Badge>} />
                ))}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucun séjour déclaré.</Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
