import { requireClient } from "@/lib/auth";
import { todayParis } from "@/lib/format";
import { STAY_OPTIONS } from "@/lib/labels";
import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { WaitingForActivation, pickProperty } from "@/components/client/property-context";
import { declareStay } from "@/app/actions/client";

export const metadata = { title: "Je viens dans ma maison" };

export default async function StayPage({ searchParams }: { searchParams: Promise<{ maison?: string }> }) {
  const { properties } = await requireClient();
  const { maison } = await searchParams;
  const property = pickProperty(properties, maison);
  if (!property) return <WaitingForActivation />;
  return (
    <div className="animate-fade-up max-w-xl">
      <PageHeader title="🏠 Je viens dans ma maison" back={{ href: "/client/demandes", label: "Mes demandes" }} subtitle="Indiquez vos dates : nous préparons votre arrivée." />
      <ActionForm action={declareStay}>
        <Card>
          {properties.length > 1 ? (
            <Select label="Maison" name="property_id" defaultValue={property.id}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          ) : (
            <input type="hidden" name="property_id" value={property.id} />
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Date d’arrivée" name="arrival_date" type="date" required min={todayParis()} />
            <Field label="Heure approximative" name="arrival_time" placeholder="vers 18h" />
          </div>
          <div className="mt-4">
            <Field label="Date de départ" name="departure_date" type="date" required min={todayParis()} />
          </div>
        </Card>
        <Card>
          <p className="text-[15px] font-medium text-forest-900 mb-3">Que souhaitez-vous que nous préparions ?</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {STAY_OPTIONS.map((o) => (
              <Checkbox key={o} name="options" value={o} label={o} />
            ))}
          </div>
        </Card>
        <Card>
          <TextArea label="Message pour Auxois Intendance" name="message" rows={4} placeholder="Nous serons quatre, merci de prévoir de quoi dîner le premier soir…" />
        </Card>
        <SubmitButton size="xl" icon="send">Envoyer ma demande</SubmitButton>
      </ActionForm>
    </div>
  );
}
