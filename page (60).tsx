import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/primitives";
import { installFirstAdmin } from "@/app/actions/auth";
import { installDemo, isDemoInstalled } from "@/app/actions/installation";
import { getSession } from "@/lib/auth";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";
import { DEMO_CLIENT_EMAIL } from "@/lib/demo";

export const metadata = { title: "Installation" };

export default async function InstallPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const { etape } = await searchParams;

  if (!hasServiceKey()) {
    return (
      <Shell>
        <Notice tone="danger">
          La clé de service Supabase n’est pas configurée (variable <code>SUPABASE_SERVICE_ROLE_KEY</code>). Suivez le guide d’installation, étape « Variables de configuration ».
        </Notice>
      </Shell>
    );
  }

  let adminExists = false;
  let dbReady = true;
  try {
    const admin = createAdminClient();
    const { count, error } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "super_admin");
    if (error) dbReady = false;
    adminExists = (count ?? 0) > 0;
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <Shell>
        <Notice tone="danger">
          La base de données ne répond pas comme prévu. Vérifiez que le fichier <code>supabase/install.sql</code> a bien été exécuté dans l’éditeur SQL de Supabase, et que les variables <code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> sont correctes.
        </Notice>
      </Shell>
    );
  }

  const { user, profile } = await getSession();

  // Étape 1 : premier compte administrateur
  if (!adminExists) {
    return (
      <Shell step={1}>
        <h1 className="text-[30px] text-forest-900">Créez votre compte administrateur</h1>
        <p className="text-ink-500 mt-1 mb-6">Ce premier compte dirige l’application. Il pourra ensuite inviter d’autres membres de l’équipe.</p>
        <ActionForm action={installFirstAdmin}>
          {process.env.SETUP_SECRET && <Field label="Code d’installation" name="setup_secret" type="password" required hint="Le code SETUP_SECRET défini dans la configuration." />}
          <Field label="Prénom et nom" name="full_name" required placeholder="Votre nom" autoComplete="name" />
          <Field label="Adresse email" name="email" type="email" required autoComplete="email" />
          <Field label="Mot de passe" name="password" type="password" required minLength={8} autoComplete="new-password" hint="8 caractères minimum" />
          <SubmitButton icon="arrowRight">Créer le compte et continuer</SubmitButton>
        </ActionForm>
      </Shell>
    );
  }

  // Étape 2 : démonstration (réservée au super administrateur connecté)
  if (!user) redirect("/connexion");
  if (profile?.role !== "super_admin") redirect("/");
  const demoInstalled = await isDemoInstalled();
  if (demoInstalled || etape === "fin") {
    return (
      <Shell step={3}>
        <h1 className="text-[30px] text-forest-900">Tout est prêt</h1>
        <p className="text-ink-500 mt-1 mb-6">Votre application est installée. Vous pouvez maintenant ouvrir votre espace.</p>
        <LinkButton href="/admin" size="lg" icon="arrowRight">
          Ouvrir mon tableau de bord
        </LinkButton>
      </Shell>
    );
  }

  return (
    <Shell step={2}>
      <h1 className="text-[30px] text-forest-900">Souhaitez-vous installer la démonstration ?</h1>
      <p className="text-ink-500 mt-1 mb-6">
        Elle ajoute trois maisons, des clients, un an de visites et des photos pour découvrir l’application. Vous pourrez tout retirer plus tard depuis Paramètres.
      </p>
      <Card className="mb-5">
        <p className="font-medium text-forest-900 mb-1">Compte du client de démonstration</p>
        <p className="text-[14px] text-ink-500 mb-4">Pour vous connecter en tant que « Jean Martin » et voir l’espace propriétaire.</p>
        <ActionForm action={installDemo}>
          <Field label="Email de Jean Martin" name="email" type="email" defaultValue={DEMO_CLIENT_EMAIL} required />
          <Field label="Mot de passe de Jean Martin" name="password" type="text" defaultValue="demo-auxois-2026" required minLength={8} hint="Notez-le : il vous servira à tester l’espace client." />
          <SubmitButton icon="sparkle" pendingText="Installation en cours (environ 30 secondes)…">
            Installer la démonstration
          </SubmitButton>
        </ActionForm>
      </Card>
      <Link href="/installation?etape=fin" className="block text-center text-forest-700 hover:underline">
        Passer cette étape
      </Link>
    </Shell>
  );
}

function Shell({ children, step }: { children: React.ReactNode; step?: number }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-lg animate-fade-up">
        <div className="flex items-center gap-3 mb-8">
          <BrandMark size={44} />
          <div>
            <p className="font-serif text-xl text-forest-900">Auxois Intendance</p>
            <p className="text-[13px] text-ink-500">Assistant d’installation</p>
          </div>
        </div>
        {step && (
          <ol className="flex gap-2 mb-6 text-[13px]">
            {["Administrateur", "Démonstration", "Terminé"].map((label, i) => (
              <li key={label} className={`flex-1 rounded-full px-3 py-1 text-center ${i + 1 <= step ? "bg-forest-800 text-cream" : "bg-stone-100 text-ink-400"}`}>
                {label}
              </li>
            ))}
          </ol>
        )}
        {children}
      </div>
    </main>
  );
}
