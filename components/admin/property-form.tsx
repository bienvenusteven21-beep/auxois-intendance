import { Checkbox, Field, Select, TextArea } from "@/components/ui/form";
import { CARNET_FIELDS } from "@/lib/labels";
import type { ClientRow, PlanRow, PropertyRow } from "@/lib/types";

export function PropertyIdentityFields({ property }: { property?: PropertyRow | null }) {
  return (
    <div className="space-y-4">
      <Field label="Nom de la propriété" name="name" required defaultValue={property?.name ?? ""} placeholder="Ex. Maison de Semur" />
      <Field label="Adresse" name="address" defaultValue={property?.address ?? ""} placeholder="5 rue du Rempart" autoComplete="street-address" />
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Field label="Code postal" name="postal_code" defaultValue={property?.postal_code ?? ""} inputMode="numeric" />
        <Field label="Commune" name="commune" defaultValue={property?.commune ?? ""} placeholder="Semur-en-Auxois" />
      </div>
      {property && <Checkbox name="is_active" label="Propriété active (suivie)" defaultChecked={property.is_active} />}
    </div>
  );
}

export function CarnetFields({ property }: { property?: PropertyRow | null }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {CARNET_FIELDS.map((f) => (
        <TextArea key={f.key} label={f.label} name={f.key} rows={2} defaultValue={(property?.[f.key as keyof PropertyRow] as string | null) ?? ""} className={f.key === "particular_notes" ? "sm:col-span-2" : ""} />
      ))}
    </div>
  );
}

export function OwnerAndPlanFields({ clients, plans, defaultClientId }: { clients: ClientRow[]; plans: PlanRow[]; defaultClientId?: string }) {
  return (
    <div className="space-y-4">
      <Select label="Propriétaire principal" name="client_id" defaultValue={defaultClientId ?? ""} hint="Vous pourrez ajouter d’autres propriétaires (couple, famille) ensuite.">
        <option value="">— À rattacher plus tard —</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.last_name} {c.first_name}
          </option>
        ))}
      </Select>
      <Select label="Formule d’abonnement" name="plan_id" defaultValue="">
        <option value="">— Sans formule pour l’instant —</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.monthly_price} €/mois, {p.visits_per_year} visites/an
          </option>
        ))}
      </Select>
      <Field label="Début de l’abonnement" name="started_on" type="date" />
    </div>
  );
}
