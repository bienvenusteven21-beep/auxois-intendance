import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** RGPD : export des données personnelles de la personne connectée (JSON). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non connecté", { status: 401 });
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return new NextResponse(error.message, { status: 400 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-donnees-auxois-intendance.json"`,
    },
  });
}
