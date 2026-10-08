import { requireStaff } from "@/lib/auth";
import { INTERVENTION_STATUS } from "@/lib/labels";
import type { ObservationRow, PartnerRow } from "@/lib/types";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { createIntervention } from "@/app/actions/interventions";

export const metadata = { title: "Nouvelle intervention" };

export default async function NewInterventionPage({ searchParams }: { searchParams: Promise<{ propriete?: string; observation?: string }> }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const [{ data: properties }, { data: partners }, obsRes] = await Promise.all([
    supabase.from("properties").select("id, name").eq("is_active", true).order("name"),
    supabase.from("partners").select("*").eq("is_active", true).order("trade").order("company").returns<PartnerRow[]>(),
    sp.observation ? supabase.from("observations").select("*").eq("id", sp.observation).maybeSingle<ObservationRow>() : Promise.resolve({ data: null }),
  ]);
  const obs = obsRes.data;
  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader title="Nouvelle intervention" back={{ href: "/admin/interventions", label: "Interventions" }} subtitle={obs ? `Suite à l’observation « ${obs.title} »` : undefined} />
      <ActionForm action={createIntervention}>
        {obs && <input type="hidden" name="observation_id" value={obs.id} />}
        <Card>
          <Select label="Propriété" name="property_id" required defaultValue={sp.propriete ?? obs?.property_id ?? ""}>
            <option value="">— Choisir —</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="mt-4 space-y-4">
            <Field label="Problème / intitulé" name="title" required defaultValue={obs?.title ?? ""} placeholder="Ex. Fuite WC étage" />
            <TextArea label="Description" name="description" defaultValue={obs?.recommended_action ?? obs?.description ?? ""} />
            <Select label="Artisan" name="partner_id" defaultValue="">
              <option value="">— À choisir plus tard —</option>
              {(partners ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company} ({p.trade})
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date prévue" name="date" type="date" />
              <Field label="Heure" name="time" type="time" defaultValue="09:00" />
            </div>
            <Select label="Statut" name="status" defaultValue="a_planifier">
              {Object.entries(INTERVENTION_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
        </Card>
        <SubmitButton icon="wrench">Créer l’intervention</SubmitButton>
      </ActionForm>
    </div>
  );
}
