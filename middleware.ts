import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les images.
    "/((?!_next/static|_next/image|favicon.ico|icons/|demo/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|pdf|html|js|json|webmanifest)$).*)",
  ],
};
