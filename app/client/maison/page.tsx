import { requireClient } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { formatDate, formatMoney, fullName } from "@/lib/format";
import { CARNET_FIELDS, HOUSE_STATUS } from "@/lib/labels";
import type { ClientRow, PlanRow, PropertyNoteRow, PropertyRow, SubscriptionRow } from "@/lib/types";
import { Badge, Card, Dot, KeyValue, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { PropertySwitcher, WaitingForActivation, pickProperty } from "@/components/client/property-context";

export const metadata = { title: "Ma maison" };

export default async function MyHousePage({ searchParams }: { searchParams: Promise<{ maison?: string }> }) {
  const { supabase, properties } = await requireClient();
  const { maison } = await searchParams;
  const property = pickProperty(properties, maison);
  if (!property) return <WaitingForActivation />;

  const [subRes, ownersRes, notesRes] = await Promise.all([
    supabase.from("subscriptions").select("*, subscription_plans(*)").eq("property_id", property.id).eq("status", "actif").maybeSingle<SubscriptionRow & { subscription_plans: PlanRow | null }>(),
    supabase.from("property_owners").select("is_primary, clients(first_name, last_name)").eq("property_id", property.id),
    supabase.from("property_notes").select("*").eq("property_id", property.id).eq("visibility", "client").order("created_at", { ascending: false }).returns<PropertyNoteRow[]>(),
  ]);
  const sub = subRes.data;
  const plan = sub?.subscription_plans;
  const st = HOUSE_STATUS[property.status];
  const owners = (ownersRes.data ?? []) as unknown as { is_primary: boolean; clients: Pick<ClientRow, "first_name" | "last_name"> | null }[];

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Ma maison" title={property.name} subtitle={[property.address, property.postal_code, property.commune].filter(Boolean).join(", ")} />
      <PropertySwitcher properties={properties} current={property} basePath="/client/maison" />

      {property.cover_photo_path && (
        <div className="rounded-3xl overflow-hidden mb-6 aspect-[16/8] bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl("photos", property.cover_photo_path)} alt={property.name} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="space-y-6">
          <Card className="flex items-center gap-4">
            <span className="text-[36px]">{st.emoji}</span>
            <div>
              <p className="text-[13px] text-ink-500">Statut général</p>
              <p className="font-serif text-[24px] text-forest-900">{st.client}</p>
            </div>
          </Card>

          <section>
            <SectionTitle>Carnet Maison</SectionTitle>
            <Card>
              <KeyValue items={CARNET_FIELDS.map((f) => ({ label: f.label, value: property[f.key as keyof PropertyRow] as string | null }))} />
              {CARNET_FIELDS.every((f) => !property[f.key as keyof PropertyRow]) && <p className="text-ink-500 text-[15px]">Le carnet de votre maison sera complété par votre intendant.</p>}
            </Card>
          </section>

          {notesRes.data?.length ? (
            <section>
              <SectionTitle>Notes de votre intendant</SectionTitle>
              <Card className="space-y-3">
                {notesRes.data.map((n) => (
                  <p key={n.id} className="text-[15px] whitespace-pre-line border-l-2 border-bronze-300 pl-3">
                    {n.body} <span className="block text-[12px] text-ink-400 mt-0.5">{formatDate(n.created_at)}</span>
                  </p>
                ))}
              </Card>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle>Ma formule</SectionTitle>
            <Card>
              {plan ? (
                <>
                  <p className="font-serif text-[24px] text-forest-900">{plan.name}</p>
                  <p className="text-ink-500 text-[15px]">
                    {formatMoney(sub?.monthly_price_override ?? plan.monthly_price)} / mois · {sub?.visits_per_year_override ?? plan.visits_per_year} visites par an
                  </p>
                  {sub?.renewal_on && <p className="text-[14px] text-ink-500 mt-1">Renouvellement le {formatDate(sub.renewal_on)}</p>}
                  <p className="text-[13px] uppercase tracking-[0.12em] text-ink-500 font-semibold mt-4 mb-2">Prestations incluses</p>
                  <ul className="space-y-1.5 text-[15px]">
                    {plan.included_services.map((s) => (
                      <li key={s} className="flex gap-2">
                        <Dot tone="ok" className="mt-2" /> {s}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[15px] text-ink-500">Votre formule sera précisée par votre intendant.</p>
              )}
            </Card>
          </section>
          <section>
            <SectionTitle>Propriétaires</SectionTitle>
            <Card>
              <ul className="space-y-1 text-[15px]">
                {owners.map((o, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {fullName(o.clients)} {o.is_primary && <Badge tone="bronze">principal</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
