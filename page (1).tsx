import { requireStaff } from "@/lib/auth";
import type { PartnerRow } from "@/lib/types";
import { Badge, EmptyState, List, PageHeader, Row } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Partenaires" };

export default async function PartnersPage() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("partners").select("*").order("trade").order("company").returns<PartnerRow[]>();
  const partners = data ?? [];
  const trades = [...new Set(partners.map((p) => p.trade))];
  return (
    <div className="animate-fade-up">
      <PageHeader title="Partenaires" subtitle="Artisans et prestataires de confiance." actions={<LinkButton href="/admin/partenaires/nouveau" icon="plus">Nouveau partenaire</LinkButton>} />
      {partners.length === 0 ? (
        <EmptyState icon="briefcase" title="Aucun partenaire" action={<LinkButton href="/admin/partenaires/nouveau" icon="plus">Ajouter un artisan</LinkButton>} />
      ) : (
        <div className="space-y-6">
          {trades.map((t) => (
            <section key={t}>
              <h2 className="text-[13px] uppercase tracking-[0.14em] text-ink-500 font-sans font-semibold mb-2">{t}</h2>
              <List>
                {partners
                  .filter((p) => p.trade === t)
                  .map((p) => (
                    <Row
                      key={p.id}
                      href={`/admin/partenaires/${p.id}`}
                      icon={<Icon name="briefcase" size={20} />}
                      title={
                        <>
                          {p.company} {!p.is_active && <Badge className="ml-1">Inactif</Badge>}
                        </>
                      }
                      subtitle={[p.contact_name, p.phone, p.zone].filter(Boolean).join(" · ")}
                    />
                  ))}
              </List>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
