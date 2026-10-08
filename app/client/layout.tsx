import { AppShell, type NavItem } from "@/components/app-shell";
import { getSettings, requireClient } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { unreadCount } from "@/lib/queries";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireClient();
  const settings = await getSettings();
  const unread = await unreadCount(supabase, user.id);

  const items: NavItem[] = [
    { href: "/client", label: "Accueil", icon: "home" },
    { href: "/client/maison", label: "Ma maison", icon: "house" },
    { href: "/client/historique", label: "Historique", icon: "history" },
    { href: "/client/interventions", label: "Interventions", icon: "wrench" },
    { href: "/client/demandes", label: "Demandes", icon: "inbox" },
    { href: "/client/documents", label: "Documents", icon: "file" },
    { href: "/client/profil", label: "Profil", icon: "user" },
  ];

  return (
    <AppShell
      items={items}
      mobileItems={["/client", "/client/maison", "/client/historique", "/client/demandes"]}
      user={{ name: profile.full_name || user.email || "", role: "Propriétaire" }}
      companyName={settings.company_name}
      unread={unread}
      signOutAction={signOut}
      accent="cream"
    >
      {children}
    </AppShell>
  );
}
