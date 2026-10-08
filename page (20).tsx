import { requireStaff } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { CarnetFields, OwnerAndPlanFields, PropertyIdentityFields } from "@/components/admin/property-form";
import { createProperty } from "@/app/actions/proprietes";
import type { ClientRow, PlanRow } from "@/lib/types";

export const metadata = { title: "Nouvelle propriété" };

export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { supabase } = await requireStaff();
  const { client } = await searchParams;
  const [{ data: clients }, { data: plans }] = await Promise.all([
    supabase.from("clients").select("*").eq("is_active", true).order("last_name").returns<ClientRow[]>(),
    supabase.from("subscription_plans").select("*").eq("is_active", true).order("position").returns<PlanRow[]>(),
  ]);
  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader title="Nouvelle propriété" back={{ href: "/admin/proprietes", label: "Propriétés" }} />
      <ActionForm action={createProperty}>
        <Card>
          <SectionTitle>Identité</SectionTitle>
          <PropertyIdentityFields />
        </Card>
        <Card>
          <SectionTitle>Propriétaire et formule</SectionTitle>
          <OwnerAndPlanFields clients={clients ?? []} plans={plans ?? []} defaultClientId={client} />
        </Card>
        <Card>
          <SectionTitle>Carnet Maison</SectionTitle>
          <p className="text-[14px] text-ink-500 mb-4">Tout ce qu’il faut savoir sur la maison. Vous pourrez compléter plus tard.</p>
          <CarnetFields />
        </Card>
        <SubmitButton icon="check">Créer la propriété</SubmitButton>
      </ActionForm>
    </div>
  );
}
