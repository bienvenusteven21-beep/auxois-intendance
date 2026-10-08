import { NextResponse } from "next/server";
import { deliverPendingNotifications } from "@/lib/notifications/deliver";

export const dynamic = "force-dynamic";

/**
 * Tâche planifiée (Vercel Cron ou autre) : expédie les notifications en attente.
 * Protégée par CRON_SECRET (en-tête Authorization: Bearer <secret>).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  const provided = auth.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const result = await deliverPendingNotifications();
  return NextResponse.json(result);
}
