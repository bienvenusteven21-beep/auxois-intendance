import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ClientFields } from "@/components/admin/client-form";
import { createClientSheet } from "@/app/actions/clients";

export const metadata = { title: "Nouveau client" };

export default function NewClientPage() {
  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader title="Nouveau client" back={{ href: "/admin/clients", label: "Clients" }} />
      <ActionForm action={createClientSheet}>
        <Card>
          <ClientFields />
        </Card>
        <SubmitButton icon="check">Créer la fiche client</SubmitButton>
      </ActionForm>
    </div>
  );
}
