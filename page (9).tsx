import { requireSuperAdmin } from "@/lib/auth";
import type { PlanRow } from "@/lib/types";
import { Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { savePlan } from "@/app/actions/parametres";

export const metadata = { title: "Formules" };

function PlanForm({ plan }: { plan?: PlanRow }) {
  return (
    <ActionForm action={savePlan} resetOnSuccess={!plan}>
      {plan && <input type="hidden" name="plan_id" value={plan.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom" name="name" required defaultValue={plan?.name ?? ""} />
        <Field label="Code" name="code" defaultValue={plan?.code ?? ""} hint="identifiant technique" />
        <Field label="Prix / mois (€)" name="monthly_price" type="text" inputMode="decimal" required defaultValue={plan?.monthly_price ?? ""} />
        <Field label="Visites / an" name="visits_per_year" type="number" min={1} max={365} required defaultValue={plan?.visits_per_year ?? 12} />
        <Field label="Ordre d’affichage" name="position" type="number" defaultValue={plan?.position ?? 0} />
      </div>
      <TextArea label="Prestations incluses (une par ligne)" name="included_services" rows={5} defaultValue={plan?.included_services.join("\n") ?? ""} />
      <Checkbox name="is_active" label="Formule proposée" defaultChecked={plan?.is_active ?? true} />
      <SubmitButton full={false} size="md" icon="check">{plan ? "Enregistrer" : "Créer la formule"}</SubmitButton>
    </ActionForm>
  );
}

export default async function PlansPage() {
  const { supabase } = await requireSuperAdmin();
  const { data } = await supabase.from("subscription_plans").select("*").order("position").returns<PlanRow[]>();
  return (
    <div className="animate-fade-up">
      <PageHeader title="Formules d’abonnement" subtitle="Le paiement en ligne n’est pas activé : les formules servent au suivi et aux statistiques." back={{ href: "/admin/parametres", label: "Paramètres" }} />
      <div className="grid lg:grid-cols-2 gap-6">
        {(data ?? []).map((p) => (
          <Card key={p.id}>
            <p className="font-serif text-[22px] text-forest-900 mb-3">
              {p.name} <span className="text-ink-500 text-[16px] font-sans">· {p.monthly_price} €/mois · {p.visits_per_year} visites/an</span>
            </p>
            <PlanForm plan={p} />
          </Card>
        ))}
        <Card className="border-dashed">
          <SectionTitle>Nouvelle formule</SectionTitle>
          <PlanForm />
        </Card>
      </div>
    </div>
  );
}
