import { getSettings, requireStaff } from "@/lib/auth";
import { Card, List, Notice, PageHeader, Row, SectionTitle } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icon";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { updateSettings } from "@/app/actions/parametres";
import { LogoUploader } from "@/components/admin/logo-uploader";
import { fileUrl } from "@/lib/files";
import { PushToggle } from "@/components/push-toggle";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const { profile } = await requireStaff();
  const settings = await getSettings();
  const isSuper = profile.role === "super_admin";

  const sections: { href: string; label: string; icon: IconName; desc: string; superOnly?: boolean }[] = [
    { href: "/admin/parametres/utilisateurs", label: "Utilisateurs", icon: "users", desc: "Équipe, rôles et comptes propriétaires.", superOnly: true },
    { href: "/admin/clients", label: "Clients", icon: "user", desc: "Fiches des propriétaires." },
    { href: "/admin/proprietes", label: "Propriétés", icon: "house", desc: "Maisons suivies et Carnet Maison." },
    { href: "/admin/parametres/formules", label: "Formules", icon: "euro", desc: "Essentiel, Sérénité, Signature : prix et prestations.", superOnly: true },
    { href: "/admin/parametres/checklists", label: "Checklists", icon: "list", desc: "Modèle standard et modèles par maison." },
    { href: "/admin/parametres/notifications", label: "Modèles de notifications", icon: "bell", desc: "Textes envoyés aux propriétaires et à l’équipe.", superOnly: true },
    { href: "/admin/partenaires", label: "Artisans", icon: "briefcase", desc: "Base des partenaires." },
    { href: "/admin/parametres/categories", label: "Catégories de documents", icon: "file", desc: "Contrat, facture, devis, notice…" },
    { href: "/admin/parametres/rgpd", label: "RGPD et journal", icon: "shield", desc: "Demandes d’export / suppression, consentements, journal d’activité." },
    { href: "/admin/parametres/demo", label: "Données de démonstration", icon: "sparkle", desc: "Installer ou retirer la démonstration.", superOnly: true },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Paramètres" subtitle="Réglages généraux et administration de l’application." />
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <div className="space-y-6">
          <section>
            <SectionTitle>Coordonnées Auxois Intendance</SectionTitle>
            {isSuper ? (
              <Card>
                <ActionForm action={updateSettings}>
                  <Field label="Nom de l’entreprise" name="company_name" defaultValue={settings.company_name} required />
                  <Field label="Sous-titre" name="tagline" defaultValue={settings.tagline} />
                  <Field label="Téléphone" name="phone" type="tel" defaultValue={settings.phone ?? ""} />
                  <Field label="Email" name="email" type="email" defaultValue={settings.email ?? ""} />
                  <Field label="Adresse" name="address" defaultValue={settings.address ?? ""} />
                  <Field label="Version de la politique de confidentialité" name="privacy_policy_version" defaultValue={settings.privacy_policy_version} hint="Changez-la pour redemander le consentement des propriétaires." />
                  <SubmitButton full={false} size="md" icon="check">Enregistrer</SubmitButton>
                </ActionForm>
                <div className="mt-6 pt-5 border-t border-stone-100">
                  <p className="font-medium text-forest-900 mb-2">Logo</p>
                  {settings.logo_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl("branding", settings.logo_path)} alt="Logo" className="h-16 mb-3 object-contain" />
                  )}
                  <LogoUploader />
                </div>
              </Card>
            ) : (
              <Card className="text-[15px] text-ink-700">
                <p className="font-medium text-forest-900">{settings.company_name}</p>
                <p>{settings.tagline}</p>
                <p className="text-ink-500 mt-2">{[settings.phone, settings.email, settings.address].filter(Boolean).join(" · ")}</p>
                <Notice tone="neutral" className="mt-3">Seul le super administrateur peut modifier ces informations.</Notice>
              </Card>
            )}
          </section>
          <section>
            <SectionTitle>Mes notifications sur cet appareil</SectionTitle>
            <Card>
              <PushToggle />
            </Card>
          </section>
        </div>
        <section>
          <SectionTitle>Administration</SectionTitle>
          <List>
            {sections
              .filter((s) => !s.superOnly || isSuper)
              .map((s) => (
                <Row key={s.href} href={s.href} icon={<Icon name={s.icon} size={20} />} title={s.label} subtitle={s.desc} />
              ))}
          </List>
        </section>
      </div>
    </div>
  );
}
