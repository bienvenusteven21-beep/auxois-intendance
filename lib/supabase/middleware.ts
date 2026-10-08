import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/installation",
  "/confidentialite",
  "/auth/callback",
  "/api/notifications/expedier",
  "/manifest.webmanifest",
  "/sw.js",
];

const STAFF_ROLES = ["super_admin", "intendant", "assistant"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }

  // Personne connectée : on vérifie le rôle pour les espaces protégés.
  const needsRole =
    pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/client");
  if (!needsRole) return response;

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.is_active ? profile.role : null;
  const isStaff = role ? STAFF_ROLES.includes(role) : false;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (pathname === "/") return redirectTo(isStaff ? "/admin" : "/client");
  if (pathname.startsWith("/admin") && !isStaff) return redirectTo("/client");
  if (pathname.startsWith("/client") && isStaff) return redirectTo("/admin");
  return response;
}
