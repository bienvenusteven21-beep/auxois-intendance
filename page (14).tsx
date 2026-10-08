import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionButton } from "@/components/ui/form";
import { deleteClientAccount, setDataRequestStatus } from "@/app/actions/parametres";

export const metadata = { title: "RGPD et journal" };

export default async function RgpdPage() {
  const { supabase, profile } = await requireStaff();
  const [{ data: requests }, { data: logs }] = await Promise.all([
    supabase.from("data_requests").select("*, users(full_name, email, role)").order("created_at", { ascending: false }).limit(50),
    profile.role === "super_admin" ? supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: null }),
  ]);
  return (
    <div className="animate-fade-up">
      <PageHeader title="RGPD et journal d’activité" back={{ href: "/admin/parametres", label: "Paramètres" }} />
      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <SectionTitle>Demandes d’export / suppression</SectionTitle>
          {requests?.length ? (
            <div className="space-y-3">
              {requests.map((r) => {
                const u = r.users as unknown as { full_name: string; email: string | null; role: string } | null;
                return (
                  <Card key={r.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-forest-900">
                        {r.kind === "export" ? "Export" : "Suppression"} · {u?.full_name || u?.email}
                      </p>
                      <Badge tone={r.status === "traitee" ? "ok" : r.status === "en_cours" ? "warn" : "danger"}>{r.status === "traitee" ? "Traitée" : r.status === "en_cours" ? "En cours" : "Nouvelle"}</Badge>
                    </div>
                    <p className="text-[13px] text-ink-500">{formatDateTime(r.created_at)} · {u?.email}</p>
                    {r.message && <p className="text-[15px] mt-2 whitespace-pre-line">{r.message}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status !== "en_cours" && r.status !== "traitee" && <ActionButton action={setDataRequestStatus.bind(null, r.id, "en_cours")} size="sm" variant="secondary">Prendre en charge</ActionButton>}
                      {r.status !== "traitee" && <ActionButton action={setDataRequestStatus.bind(null, r.id, "traitee")} size="sm" variant="primary" icon="check">Marquer traitée</ActionButton>}
                      {r.kind === "suppression" && profile.role === "super_admin" && u?.role === "client" && (
                        <ActionButton action={deleteClientAccount.bind(null, r.user_id)} size="sm" variant="danger" icon="trash" confirm="Supprimer définitivement ce compte propriétaire ? La fiche client et l’historique de la maison sont conservés, mais le compte de connexion, ses consentements et ses notifications sont effacés.">
                          Supprimer le compte
                        </ActionButton>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-[15px] text-ink-500">Aucune demande.</Card>
          )}
          <Notice tone="neutral" className="mt-4 text-[14px]">
            Le propriétaire peut exporter lui-même ses données depuis son profil. Pour un export complet, vous pouvez aussi le faire depuis l’éditeur SQL de Supabase (fonction <code>export_my_data</code>).
          </Notice>
        </section>
        <section>
          <SectionTitle>Journal d’activité</SectionTitle>
          {logs ? (
            <Card className="!p-0 divide-y divide-stone-100 max-h-[70vh] overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="px-4 py-2 text-[13px]">
                  <span className="text-ink-400">{formatDateTime(l.created_at)}</span> · <span className="font-medium text-forest-900">{l.action}</span> sur <span>{l.entity_type}</span>
                  {l.metadata && Object.keys(l.metadata).length > 0 && <span className="text-ink-500"> · {JSON.stringify(l.metadata)}</span>}
                </div>
              ))}
              {logs.length === 0 && <p className="px-4 py-4 text-ink-500">Journal vide.</p>}
            </Card>
          ) : (
            <Card className="text-[15px] text-ink-500">Le journal est réservé au super administrateur.</Card>
          )}
        </section>
      </div>
    </div>
  );
}
