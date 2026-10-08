import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { signUp } from "@/app/actions/auth";
import { getSession } from "@/lib/auth";
import { needsInstallation } from "@/lib/installation";

export const metadata = { title: "Créer mon compte" };

export default async function SignUpPage() {
  const { user } = await getSession();
  if (user) redirect("/");
  if (await needsInstallation()) redirect("/installation");
  return (
    <div>
      <h1 className="text-[32px] text-forest-900">Créer mon compte</h1>
      <p className="text-ink-500 mt-1 mb-8">
        Utilisez l’adresse email communiquée à Auxois Intendance : votre espace sera activé par notre équipe.
      </p>
      <ActionForm action={signUp}>
        <Field label="Prénom et nom" name="full_name" autoComplete="name" required placeholder="Jean Martin" />
        <Field label="Adresse email" name="email" type="email" autoComplete="email" inputMode="email" required />
        <Field label="Mot de passe" name="password" type="password" autoComplete="new-password" required minLength={8} hint="8 caractères minimum" />
        <Checkbox
          name="consent"
          label={
            <>
              J’accepte la{" "}
              <Link href="/confidentialite" className="underline" target="_blank">
                politique de confidentialité
              </Link>
              .
            </>
          }
        />
        <SubmitButton icon="arrowRight">Créer mon compte</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-[15px] text-ink-500">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-forest-700 hover:underline">
          Me connecter
        </Link>
      </p>
    </div>
  );
}
