import { AppShell, type NavItem } from "@/components/app-shell";
import { getSettings, requireStaff } from "@/lib/auth";
import { ROLES } from "@/lib/labels";
import { signOut } from "@/app/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireStaff();
  const settings = await getSettings();

  const [{ count: pendingRequests }, { count: unread }] = await Promise.all([
    supabase.from("client_requests").select("id", { count: "exact", head: true }).in("status", ["nouvelle", "vue"]),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);

  const items: NavItem[] = [
    { href: "/admin", label: "Tableau de bord", icon: "home" },
    { href: "/admin/planning", label: "Planning", icon: "calendar" },
    { href: "/admin/proprietes", label: "Propriétés", icon: "house" },
    { href: "/admin/clients", label: "Clients", icon: "users" },
    { href: "/admin/visites", label: "Visites", icon: "key" },
    { href: "/admin/interventions", label: "Interventions", icon: "wrench" },
    { href: "/admin/demandes", label: "Demandes", icon: "inbox", badge: pendingRequests ?? 0 },
    { href: "/admin/partenaires", label: "Partenaires", icon: "briefcase" },
    { href: "/admin/documents", label: "Documents", icon: "file" },
    { href: "/admin/statistiques", label: "Statistiques", icon: "chart" },
    { href: "/admin/parametres", label: "Paramètres", icon: "settings" },
  ];

  return (
    <AppShell
      items={items}
      mobileItems={["/admin", "/admin/planning", "/admin/proprietes", "/admin/demandes"]}
      user={{ name: profile.full_name || user.email || "", role: ROLES[profile.role] }}
      companyName={settings.company_name}
      unread={unread ?? 0}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
