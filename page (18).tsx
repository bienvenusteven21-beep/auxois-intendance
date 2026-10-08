import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { CarnetFields, PropertyIdentityFields } from "@/components/admin/property-form";
import { updateProperty } from "@/app/actions/proprietes";
import type { PropertyRow } from "@/lib/types";

export const metadata = { title: "Modifier la propriété" };

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: property } = await supabase.from("properties").select("*").eq("id", id).maybeSingle<PropertyRow>();
  if (!property) notFound();
  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader title={property.name} subtitle="Modifier la fiche et le Carnet Maison" back={{ href: `/admin/proprietes/${id}`, label: "Fiche propriété" }} />
      <ActionForm action={updateProperty} successMessage="Enregistré." redirectTo={`/admin/proprietes/${id}`}>
        <input type="hidden" name="property_id" value={property.id} />
        <Card>
          <SectionTitle>Identité</SectionTitle>
          <PropertyIdentityFields property={property} />
        </Card>
        <Card>
          <SectionTitle>Carnet Maison</SectionTitle>
          <div id="carnet">
            <CarnetFields property={property} />
          </div>
        </Card>
        <SubmitButton icon="check">Enregistrer</SubmitButton>
      </ActionForm>
    </div>
  );
}
