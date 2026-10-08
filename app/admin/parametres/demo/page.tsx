import { requireSuperAdmin } from "@/lib/auth";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";
import { ActionButton, ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { installDemo, isDemoInstalled, removeDemo } from "@/app/actions/installation";
import { DEMO_CLIENT_EMAIL } from "@/lib/demo";
import { hasServiceKey } from "@/lib/supabase/admin";

export const metadata = { title: "Données de démonstration" };

export default async function DemoPage() {
  await requireSuperAdmin();
  const installed = hasServiceKey() ? await isDemoInstalled() : false;
  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader title="Données de démonstration" back={{ href: "/admin/parametres", label: "Paramètres" }} subtitle="Trois maisons, quatre clients, un an de visites, photos et documents pour découvrir l’application." />
      {!hasServiceKey() && <Notice tone="danger">La clé de service Supabase n’est pas configurée.</Notice>}
      {installed ? (
        <Card>
          <p className="text-[15px] text-ink-700 mb-4">
            La démonstration est installée. Avant de passer en production avec vos vrais clients, retirez-la : toutes les maisons, clients, visites, photos et documents de démonstration seront supprimés, ainsi que le compte « Jean Martin ».
          </p>
          <ActionButton action={removeDemo} variant="danger" icon="trash" confirm="Supprimer définitivement toutes les données de démonstration ?">
            Retirer les données de démonstration
          </ActionButton>
        </Card>
      ) : (
        <Card>
          <ActionForm action={installDemo}>
            <Field label="Email du client de démonstration (Jean Martin)" name="email" type="email" defaultValue={DEMO_CLIENT_EMAIL} required />
            <Field label="Mot de passe du client de démonstration" name="password" type="text" defaultValue="demo-auxois-2026" required minLength={8} />
            <SubmitButton icon="sparkle" pendingText="Installation en cours…">Installer la démonstration</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
