import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { HOUSE_STATUS } from "@/lib/labels";
import { formatDate, fullName } from "@/lib/format";
import { fileUrl } from "@/lib/files";
import { activePlanName } from "@/lib/queries";
import { Badge, Dot, EmptyState, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import type { HouseStatus } from "@/lib/types";

export const metadata = { title: "Propriétés" };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ q?: string; inactives?: string }> }) {
  const { supabase } = await requireStaff();
  const { q, inactives } = await searchParams;
  let query = supabase
    .from("properties")
    .select("id, name, commune, status, is_active, cover_photo_path, property_owners(clients(first_name, last_name)), subscriptions(status, subscription_plans(name)), visits(scheduled_at, status, ended_at)")
    .order("name");
  if (!inactives) query = query.eq("is_active", true);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data } = await query;
  const properties = data ?? [];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Propriétés"
        subtitle={`${properties.length} maison${properties.length > 1 ? "s" : ""} suivie${properties.length > 1 ? "s" : ""}`}
        actions={<LinkButton href="/admin/proprietes/nouvelle" icon="plus">Nouvelle propriété</LinkButton>}
      />
      <form className="mb-5 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Rechercher une maison…" className="flex-1 rounded-xl border border-stone-300 bg-white px-4 min-h-[48px]" />
        {inactives && <input type="hidden" name="inactives" value="1" />}
        <button className="rounded-xl bg-stone-100 px-4 min-h-[48px] font-medium">Rechercher</button>
      </form>
      {properties.length === 0 ? (
        <EmptyState icon="house" title="Aucune propriété" action={<LinkButton href="/admin/proprietes/nouvelle" icon="plus">Créer la première propriété</LinkButton>} />
      ) : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((p) => {
            const owners = (p.property_owners as unknown as { clients: { first_name: string; last_name: string } | null }[]).map((o) => fullName(o.clients)).filter(Boolean);
            const visits = (p.visits as unknown as { scheduled_at: string; status: string; ended_at: string | null }[]) ?? [];
            const next = visits.filter((v) => v.status === "planifiee").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
            const last = visits.filter((v) => v.status === "terminee").sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];
            const st = HOUSE_STATUS[p.status as HouseStatus];
            return (
              <li key={p.id}>
                <Link href={`/admin/proprietes/${p.id}`} className="block overflow-hidden rounded-2xl bg-white border border-stone-200/60 shadow-soft hover:border-forest-300 transition">
                  <div className="aspect-[16/7] bg-forest-100 relative">
                    {p.cover_photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl("photos", p.cover_photo_path)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-forest-300 font-serif text-3xl">{p.name.slice(0, 1)}</div>
                    )}
                    <span className="absolute top-3 left-3">
                      <Badge tone={st.tone}>
                        <Dot tone={st.tone} /> {st.label}
                      </Badge>
                    </span>
                    {!p.is_active && <span className="absolute top-3 right-3"><Badge>Inactive</Badge></span>}
                  </div>
                  <div className="p-4">
                    <p className="font-serif text-[20px] text-forest-900 leading-tight">{p.name}</p>
                    <p className="text-[14px] text-ink-500">
                      {p.commune ?? "—"}
                      {activePlanName(p) ? ` · Formule ${activePlanName(p)}` : ""}
                    </p>
                    <p className="text-[14px] text-ink-700 mt-2 truncate">{owners.join(", ") || "Aucun propriétaire rattaché"}</p>
                    <div className="mt-3 flex justify-between text-[13px] text-ink-500">
                      <span>Dernière : {last ? formatDate(last.ended_at, { year: false }) : "—"}</span>
                      <span>Prochaine : {next ? formatDate(next.scheduled_at, { year: false }) : "—"}</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-[14px] text-ink-500">
        {inactives ? (
          <Link href="/admin/proprietes" className="text-forest-700 hover:underline">Masquer les propriétés inactives</Link>
        ) : (
          <Link href="/admin/proprietes?inactives=1" className="text-forest-700 hover:underline">Afficher aussi les propriétés inactives</Link>
        )}
      </p>
    </div>
  );
}
