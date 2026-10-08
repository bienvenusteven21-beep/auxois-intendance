import { Checkbox, Field, Select, TextArea } from "@/components/ui/form";
import type { ClientRow } from "@/lib/types";

export function ClientFields({ client, notes }: { client?: ClientRow | null; notes?: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" name="first_name" required defaultValue={client?.first_name ?? ""} autoComplete="given-name" />
        <Field label="Nom" name="last_name" required defaultValue={client?.last_name ?? ""} autoComplete="family-name" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Téléphone" name="phone" type="tel" defaultValue={client?.phone ?? ""} inputMode="tel" />
        <Field label="Email" name="email" type="email" defaultValue={client?.email ?? ""} inputMode="email" hint="Servira d’identifiant de connexion." />
      </div>
      <Field label="Adresse principale" name="main_address" defaultValue={client?.main_address ?? ""} placeholder="Adresse de résidence habituelle" />
      <Select label="Langue préférée" name="preferred_language" defaultValue={client?.preferred_language ?? "fr"}>
        <option value="fr">Français</option>
        <option value="en">Anglais</option>
        <option value="nl">Néerlandais</option>
        <option value="de">Allemand</option>
      </Select>
      <TextArea label="Notes internes" name="notes" defaultValue={notes ?? ""} hint="Jamais visibles par le client." />
      {client && <Checkbox name="is_active" label="Client actif" defaultChecked={client.is_active} />}
    </div>
  );
}
