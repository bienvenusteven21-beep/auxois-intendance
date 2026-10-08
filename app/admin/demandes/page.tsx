import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime, fullName } from "@/lib/format";
import { REQUEST_STATUS, STAY_STATUS } from "@/lib/labels";
import type { ClientRequestRow, StayRow } from "@/lib/types";
import { Badge, Card, EmptyState, List, PageHeader, Row, SectionTitle } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { createRequestAsStaff } from "@/app/actions/demandes";

export const metadata = { title: "Demandes clients" };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { supabase } = await requireStaff();
  const { onglet } = await searchParams;
  const closed = onglet === "terminees";
  const [{ data: requests }, { data: stays }, { data: properties }] = await Promise.all([
    supabase
      .from("client_requests")
      .select("*, properties(name), clients(first_name, last_name)")
      .in("status", closed ? ["terminee"] : ["nouvelle", "vue", "planifiee", "en_cours"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("stays").select("*, properties(name), clients(first_name, last_name)").gte("departure_date", new Date().toISOString().slice(0, 10)).neq("status", "annule").order("arrival_date").limit(20),
    supabase.from("properties").select("id, name").eq("is_active", true).order("name"),
  ]);
  const list = (requests ?? []) as unknown as (ClientRequestRow & { properties: { name: string } | null; clients: { first_name: string; last_name: string } | null })[];
  const upcoming = (stays ?? []) as unknown as (StayRow & { properties: { name: string } | null; clients: { first_name: string; last_name: string } | null })[];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Demandes clients" subtitle="Séjours annoncés, demandes libres et demandes de contact." />
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div>
          <div className="flex rounded-xl bg-stone-100 p-1 mb-4 text-[14px] font-medium w-fit">
            <Link href="/admin/demandes" className={`px-4 py-2 rounded-lg ${!closed ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>À traiter</Link>
            <Link href="/admin/demandes?onglet=terminees" className={`px-4 py-2 rounded-lg ${closed ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>Terminées</Link>
          </div>
          {list.length === 0 ? (
            <EmptyState icon="inbox" title={closed ? "Aucune demande terminée" : "Aucune demande à traiter"} />
          ) : (
            <List>
              {list.map((r) => (
                <Row
                  key={r.id}
                  href={`/admin/demandes/${r.id}`}
                  icon={<Icon name={r.kind === "sejour" ? "house" : r.kind === "contact" ? "phone" : "inbox"} size={20} />}
                  title={r.subject}
                  subtitle={`${r.properties?.name ?? ""} · ${fullName(r.clients)} · ${formatDateTime(r.created_at)}${r.planned_for ? ` · prévu le ${formatDate(r.planned_for, { year: false })}` : ""}`}
                  right={<Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>}
                />
              ))}
            </List>
          )}
        </div>
        <div className="space-y-6">
          <section>
            <SectionTitle>Séjours à venir</SectionTitle>
            {upcoming.length ? (
              <List>
                {upcoming.map((s) => (
                  <div key={s.id} className="px-4 py-3">
                    <p className="font-medium text-forest-900">{s.properties?.name} · {fullName(s.clients)}</p>
                    <p className="text-[14px] text-ink-500">Du {formatDate(s.arrival_date, { year: false })}{s.arrival_time ? ` (${s.arrival_time})` : ""} au {formatDate(s.departure_date, { year: false })}</p>
                    {s.options.length > 0 && <p className="text-[13px] text-ink-700 mt-1">{s.options.join(" · ")}</p>}
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge tone={STAY_STATUS[s.status].tone}>{STAY_STATUS[s.status].label}</Badge>
                      <Link href={`/admin/visites/nouvelle?propriete=${s.property_id}&sejour=${s.id}&date=${s.arrival_date}`} className="text-[13px] text-forest-700 hover:underline">Planifier la préparation</Link>
                    </div>
                  </div>
                ))}
              </List>
            ) : (
              <Card className="text-[15px] text-ink-500">Aucun séjour annoncé.</Card>
            )}
          </section>
          <section>
            <SectionTitle>Saisir une demande reçue par téléphone</SectionTitle>
            <Card>
              <ActionForm action={createRequestAsStaff} resetOnSuccess>
                <Select label="Propriété" name="property_id" required>
                  <option value="">— Choisir —</option>
                  {(properties ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Field label="Objet" name="subject" required placeholder="Ex. Ouvrir au plombier mardi" />
                <TextArea label="Détails" name="message" rows={2} />
                <SubmitButton full={false} size="md" icon="plus">Enregistrer</SubmitButton>
              </ActionForm>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
