import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDate, fullName } from "@/lib/format";
import { Badge, EmptyState, List, PageHeader, Row } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; inactifs?: string }> }) {
  const { supabase } = await requireStaff();
  const { q, inactifs } = await searchParams;
  let query = supabase.from("clients").select("*, property_owners(properties(name))").order("last_name").order("first_name");
  if (!inactifs) query = query.eq("is_active", true);
  if (q) query = query.or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data } = await query;
  const clients = data ?? [];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Clients" subtitle={`${clients.length} propriétaire${clients.length > 1 ? "s" : ""}`} actions={<LinkButton href="/admin/clients/nouveau" icon="plus">Nouveau client</LinkButton>} />
      <form className="mb-5 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nom, prénom ou email…" className="flex-1 rounded-xl border border-stone-300 bg-white px-4 min-h-[48px]" />
        {inactifs && <input type="hidden" name="inactifs" value="1" />}
        <button className="rounded-xl bg-stone-100 px-4 min-h-[48px] font-medium">Rechercher</button>
      </form>
      {clients.length === 0 ? (
        <EmptyState icon="users" title="Aucun client" action={<LinkButton href="/admin/clients/nouveau" icon="plus">Créer le premier client</LinkButton>} />
      ) : (
        <List>
          {clients.map((c) => {
            const props = (c.property_owners as unknown as { properties: { name: string } | null }[]).map((o) => o.properties?.name).filter(Boolean);
            return (
              <Row
                key={c.id}
                href={`/admin/clients/${c.id}`}
                icon={<Icon name="user" size={20} />}
                title={
                  <>
                    {fullName(c)} {!c.is_active && <Badge className="ml-1">Inactif</Badge>}
                  </>
                }
                subtitle={props.length ? props.join(", ") : "Aucune propriété rattachée"}
                right={
                  <span className="hidden sm:flex items-center gap-2">
                    {c.user_id ? <Badge tone="ok">Accès actif</Badge> : <Badge tone="warn">Sans accès</Badge>}
                    <span className="text-ink-400">{formatDate(c.created_at, { year: true })}</span>
                  </span>
                }
              />
            );
          })}
        </List>
      )}
      <p className="mt-6 text-[14px] text-ink-500">
        {inactifs ? <Link href="/admin/clients" className="text-forest-700 hover:underline">Masquer les clients inactifs</Link> : <Link href="/admin/clients?inactifs=1" className="text-forest-700 hover:underline">Afficher aussi les clients inactifs</Link>}
      </p>
    </div>
  );
}
