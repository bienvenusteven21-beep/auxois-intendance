import { Checkbox, Field, Select, TextArea } from "@/components/ui/form";
import { TRADES } from "@/lib/labels";
import type { PartnerRow } from "@/lib/types";

export function PartnerFields({ partner }: { partner?: PartnerRow | null }) {
  const trades = partner?.trade && !TRADES.includes(partner.trade) ? [partner.trade, ...TRADES] : TRADES;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Entreprise" name="company" required defaultValue={partner?.company ?? ""} />
        <Select label="Métier" name="trade" defaultValue={partner?.trade ?? "Plombier"}>
          {trades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Field label="Prénom / contact" name="contact_name" defaultValue={partner?.contact_name ?? ""} />
        <Field label="Téléphone" name="phone" type="tel" defaultValue={partner?.phone ?? ""} />
        <Field label="Email" name="email" type="email" defaultValue={partner?.email ?? ""} />
        <Field label="Zone géographique" name="zone" defaultValue={partner?.zone ?? ""} placeholder="Semur-en-Auxois et 20 km" />
      </div>
      <TextArea label="Notes internes" name="internal_notes" defaultValue={partner?.internal_notes ?? ""} />
      {partner && <Checkbox name="is_active" label="Partenaire actif" defaultChecked={partner.is_active} />}
    </div>
  );
}
