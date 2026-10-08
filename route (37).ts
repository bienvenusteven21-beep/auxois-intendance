import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKETS = ["photos", "documents", "branding"];

/**
 * Sert un fichier privé via une URL signée temporaire.
 * Les règles de sécurité du stockage (0004_storage.sql) décident qui peut lire quoi.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params;
  if (!BUCKETS.includes(bucket)) return new NextResponse("Introuvable", { status: 404 });
  const objectPath = path.map(decodeURIComponent).join("/");
  const supabase = await createClient();
  const download = new URL(_request.url).searchParams.get("telecharger");
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 600, download ? { download: download === "1" ? true : download } : undefined);
  if (error || !data?.signedUrl) return new NextResponse("Accès refusé", { status: 403 });
  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
