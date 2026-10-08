import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime, fullName, toDateInput, toTimeInput } from "@/lib/format";
import { REQUEST_STATUS, STAY_STATUS } from "@/lib/labels";
import type { ClientRequestRow, ObservationRow, RequestStatus, StayRow } from "@/lib/types";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionButton, ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import { markRequestSeen, setRequestStatus, updateRequest, updateStayStatus } from "@/app/actions/demandes";

const FLOW: RequestStatus[] = ["nouvelle", "vue", "planifiee", "en_cours", "terminee"];

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: r } = await supabase
    .from("client_requests")
    .select("*, properties(id, name), clients(id, first_name, last_name, phone, email)")
    .eq("id", id)
    .maybeSingle<ClientRequestRow & { properties: { id: string; name: string } | null; clients: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null } | null }>();
  if (!r) notFound();
  if (r.status === "nouvelle") await markRequestSeen(r.id);

  const [stayRes, obsRes] = await Promise.all([
    r.stay_id ? supabase.from("stays").select("*").eq("id", r.stay_id).maybeSingle<StayRow>() : Promise.resolve({ data: null }),
    r.observation_id ? supabase.from("observations").select("*").eq("id", r.observation_id).maybeSingle<ObservationRow>() : Promise.resolve({ data: null }),
  ]);
  const stay = stayRes.data;
  const status = r.status === "nouvelle" ? "vue" : r.status;
  const idx = FLOW.indexOf(status);
  const next = idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader
        back={{ href: "/admin/demandes", label: "Demandes" }}
        eyebrow={`${r.kind === "sejour" ? "Séjour" : r.kind === "contact" ? "Demande de contact" : "Demande"} · ${r.properties?.name ?? ""}`}
        title={r.subject}
        subtitle={`${fullName(r.clients)}${r.clients?.phone ? ` · ${r.clients.phone}` : ""} · reçue le ${formatDateTime(r.created_at)}`}
        actions={
          next ? (
            <ActionButton action={setRequestStatus.bind(null, r.id, next)} variant={next === "terminee" ? "bronze" : "primary"} icon={next === "terminee" ? "check" : "arrowRight"}>
              Marquer « {REQUEST_STATUS[next].label} »
            </ActionButton>
          ) : null
        }
      />

      <div className="flex items-center gap-2 mb-5">
        <Badge tone={REQUEST_STATUS[status].tone} className="text-[14px]">{REQUEST_STATUS[status].label}</Badge>
        {r.planned_for && <span className="text-[14px] text-ink-500">Prévu le {formatDateTime(r.planned_for)}</span>}
      </div>

      {r.message && (
        <Card className="mb-5 border-l-4 border-l-bronze-400">
          <p className="whitespace-pre-line text-[16px] font-serif leading-relaxed">{r.message}</p>
        </Card>
      )}

      {stay && (
        <Card className="mb-5">
          <SectionTitle>Séjour</SectionTitle>
          <p className="text-[16px] text-forest-900">
            Du <strong>{formatDate(stay.arrival_date, { weekday: true })}</strong>
            {stay.arrival_time ? ` (${stay.arrival_time})` : ""} au <strong>{formatDate(stay.departure_date, { weekday: true })}</strong>
          </p>
          {stay.options.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {stay.options.map((o) => (
                <li key={o} className="rounded-full bg-forest-50 text-forest-800 px-3 py-1 text-[14px]">{o}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={STAY_STATUS[stay.status].tone}>{STAY_STATUS[stay.status].label}</Badge>
            <LinkButton href={`/admin/visites/nouvelle?propriete=${r.property_id}&sejour=${stay.id}&date=${stay.arrival_date}`} size="sm" variant="secondary" icon="calendar">Planifier la préparation</LinkButton>
            {stay.status !== "annule" && stay.status !== "termine" && (
              <ActionButton action={updateStayStatus.bind(null, stay.id, "annule")} size="sm" variant="ghost" confirm="Annuler ce séjour ?">Séjour annulé</ActionButton>
            )}
          </div>
        </Card>
      )}

      {obsRes.data && (
        <Card className="mb-5 text-[15px]">
          Concerne l’observation <Link href={`/admin/observations/${obsRes.data.id}`} className="text-forest-700 underline">{obsRes.data.title}</Link>. Le propriétaire souhaite être contacté avant toute intervention.
        </Card>
      )}

      <Card>
        <SectionTitle>Traitement</SectionTitle>
        <ActionForm action={updateRequest}>
          <input type="hidden" name="request_id" value={r.id} />
          <Select label="Statut" name="status" defaultValue={status}>
            {FLOW.filter((s) => s !== "nouvelle").map((s) => (
              <option key={s} value={s}>
                {REQUEST_STATUS[s].label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date prévue" name="date" type="date" defaultValue={toDateInput(r.planned_for)} />
            <Field label="Heure" name="time" type="time" defaultValue={toTimeInput(r.planned_for) || "09:00"} />
          </div>
          <TextArea label="Réponse au propriétaire" name="reply" rows={3} defaultValue={r.reply ?? ""} hint="Transmise avec la notification « demande traitée »." />
          <SubmitButton full={false} size="md" icon="check">Enregistrer</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
