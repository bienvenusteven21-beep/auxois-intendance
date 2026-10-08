import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { PartnerFields } from "@/components/admin/partner-form";
import { createPartner } from "@/app/actions/partenaires";

export const metadata = { title: "Nouveau partenaire" };

export default function NewPartnerPage() {
  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader title="Nouveau partenaire" back={{ href: "/admin/partenaires", label: "Partenaires" }} />
      <ActionForm action={createPartner}>
        <Card>
          <PartnerFields />
        </Card>
        <SubmitButton icon="check">Enregistrer</SubmitButton>
      </ActionForm>
    </div>
  );
}
