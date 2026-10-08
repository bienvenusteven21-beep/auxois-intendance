import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildVisitReport } from "@/lib/pdf/visit-report";
import { isRasterImage } from "@/lib/files";
import { toDateInput } from "@/lib/format";
import type { ObservationRow, PhotoRow, PropertyRow, SettingsRow, VisitItemRow, VisitRow, VisitSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rapport PDF d’une visite. Les règles RLS s’appliquent : l’équipe voit tout,
 * un propriétaire uniquement les visites dont le débrief lui a été envoyé.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", id).maybeSingle<VisitRow>();
  if (!visit || visit.status !== "terminee") return new NextResponse("Rapport indisponible", { status: 404 });

  const [{ data: property }, { data: settings }, { data: items }, { data: observations }, { data: photos }, { data: summary }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", visit.property_id).maybeSingle<PropertyRow>(),
    supabase.from("settings").select("*").maybeSingle<SettingsRow>(),
    supabase.from("visit_checklist_items").select("*").eq("visit_id", id).order("position").returns<VisitItemRow[]>(),
    supabase.from("observations").select("*").eq("visit_id", id).order("created_at").returns<ObservationRow[]>(),
    supabase.from("photos").select("*").eq("visit_id", id).order("taken_at").limit(24).returns<PhotoRow[]>(),
    supabase.rpc("visit_summary", { p_visit_id: id }),
  ]);
  if (!property) return new NextResponse("Rapport indisponible", { status: 404 });

  const withBytes = await Promise.all(
    (photos ?? []).map(async (p) => {
      if (!isRasterImage(p.storage_path)) return { ...p, bytes: null };
      const { data } = await supabase.storage.from("photos").download(p.storage_path);
      return { ...p, bytes: data ? new Uint8Array(await data.arrayBuffer()) : null };
    }),
  );

  const pdf = await buildVisitReport({
    company: settings
      ? { name: settings.company_name, tagline: settings.tagline, phone: settings.phone, email: settings.email, address: settings.address }
      : { name: "Auxois Intendance", tagline: "Votre maison, suivie toute l’année." },
    property,
    visit,
    items: items ?? [],
    observations: observations ?? [],
    photos: withBytes,
    summary: (summary as VisitSummary) ?? null,
  });

  const safeName = property.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rapport-visite-${safeName}-${toDateInput(visit.ended_at)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
