import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { signIn } from "@/app/actions/auth";
import { getSession, isStaffRole } from "@/lib/auth";
import { needsInstallation } from "@/lib/installation";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; message?: string }> }) {
  const { suite, message } = await searchParams;
  const { user, profile } = await getSession();
  if (user) redirect(isStaffRole(profile?.role) ? "/admin" : "/client");

  // Première utilisation : on guide vers l’assistant d’installation.
  if (await needsInstallation()) redirect("/installation");

  return (
    <div>
      <h1 className="text-[32px] text-forest-900">Bienvenue</h1>
      <p className="text-ink-500 mt-1 mb-8">Connectez-vous pour accéder à votre espace.</p>
      {message && <p className="rounded-xl bg-ok-100 text-ok-600 px-4 py-3 mb-4 text-[15px]">{message}</p>}
      <ActionForm action={signIn}>
        <input type="hidden" name="next" value={suite ?? ""} />
        <Field label="Adresse email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="vous@exemple.fr" />
        <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton icon="arrowRight">Me connecter</SubmitButton>
      </ActionForm>
      <div className="mt-6 flex flex-col gap-2 text-[15px] text-center">
        <Link href="/mot-de-passe-oublie" className="text-forest-700 hover:underline">
          Mot de passe oublié ?
        </Link>
        <p className="text-ink-500">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="text-forest-700 hover:underline">
            Créer mon compte
          </Link>
        </p>
      </div>
    </div>
  );
}
