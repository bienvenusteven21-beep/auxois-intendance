import { requireClient } from "@/lib/auth";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { WaitingForActivation, pickProperty } from "@/components/client/property-context";
import { createRequest } from "@/app/actions/client";

export const metadata = { title: "Nouvelle demande" };

const EXAMPLES = ["Pouvez-vous ouvrir à mon plombier mardi ?", "Pouvez-vous vérifier si j’ai laissé une fenêtre ouverte ?", "Pouvez-vous préparer la maison vendredi ?"];

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ maison?: string }> }) {
  const { properties } = await requireClient();
  const { maison } = await searchParams;
  const property = pickProperty(properties, maison);
  if (!property) return <WaitingForActivation />;
  return (
    <div className="animate-fade-up max-w-xl">
      <PageHeader title="Faire une demande" back={{ href: "/client/demandes", label: "Mes demandes" }} subtitle="Décrivez simplement ce dont vous avez besoin." />
      <ActionForm action={createRequest}>
        <Card>
          {properties.length > 1 ? (
            <Select label="Maison concernée" name="property_id" defaultValue={property.id}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          ) : (
            <input type="hidden" name="property_id" value={property.id} />
          )}
          <div className="mt-4 space-y-4">
            <Field label="Ma demande, en quelques mots" name="subject" required maxLength={200} placeholder={EXAMPLES[0]} list="exemples" />
            <datalist id="exemples">
              {EXAMPLES.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
            <TextArea label="Précisions (facultatif)" name="message" rows={4} placeholder="Jour, heure, détails utiles…" />
          </div>
        </Card>
        <SubmitButton size="xl" icon="send">Envoyer ma demande</SubmitButton>
      </ActionForm>
    </div>
  );
}
