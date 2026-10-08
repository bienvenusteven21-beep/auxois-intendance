import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { OBS_LEVEL } from "@/lib/labels";
import type { ObservationRow } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { ObservationCard } from "@/components/observation-card";

export const metadata = { title: "Observations" };

export default async function ObservationsPage({ searchParams }: { searchParams: Promise<{ niveau?: string; propriete?: string; tout?: string }> }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  let q = supabase.from("observations").select("*, properties(name)").order("observed_at", { ascending: false }).limit(100);
  if (!sp.tout) q = q.not("status", "in", '("resolu","classe_sans_suite")');
  if (sp.niveau) q = q.eq("level", sp.niveau);
  if (sp.propriete) q = q.eq("property_id", sp.propriete);
  const { data } = await q;
  const list = (data ?? []) as unknown as (ObservationRow & { properties: { name: string } | null })[];
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/admin/observations?${p.toString()}`;
  };
  return (
    <div className="animate-fade-up">
      <PageHeader title="Observations" subtitle={sp.tout ? "Toutes les observations, résolues comprises." : "Points ouverts à suivre, toutes maisons confondues."} />
      <div className="flex flex-wrap gap-2 mb-5 text-[14px]">
        <Link href={link({ niveau: undefined })} className={`rounded-full px-3 py-1.5 ${!sp.niveau ? "bg-forest-800 text-cream" : "bg-stone-100 text-ink-700"}`}>Tous niveaux</Link>
        {Object.entries(OBS_LEVEL).map(([k, v]) => (
          <Link key={k} href={link({ niveau: k })} className={`rounded-full px-3 py-1.5 ${sp.niveau === k ? "bg-forest-800 text-cream" : "bg-stone-100 text-ink-700"}`}>
            {v.emoji} {v.label}
          </Link>
        ))}
        <Link href={link({ tout: sp.tout ? undefined : "1" })} className="rounded-full px-3 py-1.5 text-forest-700 underline">
          {sp.tout ? "Masquer les résolues" : "Afficher aussi les résolues"}
        </Link>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="check" title="Rien à signaler">Aucune observation ne correspond à ce filtre.</EmptyState>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {list.map((o) => (
            <ObservationCard key={o.id} o={o} staff href={`/admin/observations/${o.id}`} propertyName={o.properties?.name} />
          ))}
        </div>
      )}
    </div>
  );
}
