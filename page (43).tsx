import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { updatePassword } from "@/app/actions/auth";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage() {
  const { user } = await getSession();
  if (!user) redirect("/connexion?message=" + encodeURIComponent("Le lien a expiré. Demandez un nouveau lien."));
  return (
    <div>
      <h1 className="text-[32px] text-forest-900">Nouveau mot de passe</h1>
      <p className="text-ink-500 mt-1 mb-8">Choisissez un mot de passe d’au moins 8 caractères.</p>
      <ActionForm action={updatePassword} redirectTo="/">
        <Field label="Nouveau mot de passe" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <Field label="Confirmer le mot de passe" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        <SubmitButton icon="check">Enregistrer</SubmitButton>
      </ActionForm>
    </div>
  );
}
