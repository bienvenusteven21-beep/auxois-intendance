import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { forgotPassword } from "@/app/actions/auth";

export const metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-[32px] text-forest-900">Mot de passe oublié</h1>
      <p className="text-ink-500 mt-1 mb-8">Indiquez votre adresse email : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
      <ActionForm action={forgotPassword}>
        <Field label="Adresse email" name="email" type="email" autoComplete="email" inputMode="email" required />
        <SubmitButton icon="send">Envoyer le lien</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-[15px]">
        <Link href="/connexion" className="text-forest-700 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
