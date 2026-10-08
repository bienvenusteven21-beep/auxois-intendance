import Link from "next/link";
import { getSettings, requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { PushToggle } from "@/components/push-toggle";
import { signOut, updatePassword, updateProfile } from "@/app/actions/auth";
import { requestDataDeletion } from "@/app/actions/client";

export const metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const { supabase, user, profile, client } = await requireClient();
  const settings = await getSettings();
  const [{ data: consents }, { data: dataRequests }] = await Promise.all([
    supabase.from("consents").select("policy_version, accepted_at").eq("user_id", user.id).order("accepted_at", { ascending: false }),
    supabase.from("data_requests").select("kind, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader title="Mon profil" subtitle={user.email ?? ""} />
      <div className="space-y-6">
        <section>
          <SectionTitle>Mes informations</SectionTitle>
          <Card>
            <ActionForm action={updateProfile}>
              <Field label="Prénom et nom" name="full_name" defaultValue={profile.full_name} required autoComplete="name" />
              <Field label="Téléphone" name="phone" type="tel" defaultValue={profile.phone ?? client?.phone ?? ""} autoComplete="tel" />
              <Select label="Langue" name="language" defaultValue={profile.language}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
              {client?.main_address && <p className="text-[14px] text-ink-500">Adresse principale : {client.main_address}. Contactez-nous pour la modifier.</p>}
              <SubmitButton full={false} size="md" icon="check">Enregistrer</SubmitButton>
            </ActionForm>
          </Card>
        </section>

        <section>
          <SectionTitle>Notifications</SectionTitle>
          <Card>
            <PushToggle />
            <p className="text-[13px] text-ink-500 mt-3">Vous recevez aussi un email à chaque événement important (visite terminée, intervention, demande traitée).</p>
          </Card>
        </section>

        <section>
          <SectionTitle>Mot de passe</SectionTitle>
          <Card>
            <ActionForm action={updatePassword}>
              <Field label="Nouveau mot de passe" name="password" type="password" minLength={8} required autoComplete="new-password" />
              <Field label="Confirmer" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
              <SubmitButton full={false} size="md" variant="secondary" icon="lock">Changer mon mot de passe</SubmitButton>
            </ActionForm>
          </Card>
        </section>

        <section>
          <SectionTitle>Mes données personnelles</SectionTitle>
          <Card className="space-y-4 text-[15px]">
            <p className="text-ink-700">
              Vous avez accepté la <Link href="/confidentialite" className="text-forest-700 underline">politique de confidentialité</Link>
              {consents?.[0] ? ` (version ${consents[0].policy_version}, le ${formatDate(consents[0].accepted_at)})` : ""}.
            </p>
            <a href="/api/mes-donnees" className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 min-h-[48px] font-medium text-forest-900">
              <Icon name="download" size={18} /> Télécharger une copie de mes données
            </a>
            {dataRequests?.some((d) => d.kind === "suppression" && d.status !== "traitee") ? (
              <Notice tone="info">Votre demande de suppression est en cours de traitement.</Notice>
            ) : (
              <details>
                <summary className="cursor-pointer text-ink-500">Demander la suppression de mon compte</summary>
                <ActionForm action={requestDataDeletion} className="mt-3">
                  <TextArea label="Message (facultatif)" name="message" rows={2} />
                  <SubmitButton full={false} size="md" variant="danger" icon="trash">Envoyer la demande de suppression</SubmitButton>
                </ActionForm>
              </details>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>{settings.company_name}</SectionTitle>
          <Card className="text-[15px] text-ink-700">
            {settings.phone && <p>Téléphone : <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-forest-700 underline">{settings.phone}</a></p>}
            {settings.email && <p>Email : <a href={`mailto:${settings.email}`} className="text-forest-700 underline">{settings.email}</a></p>}
            {settings.address && <p>{settings.address}</p>}
          </Card>
        </section>

        <form action={signOut}>
          <button className="inline-flex items-center gap-2 text-forest-800 font-medium min-h-[48px]">
            <Icon name="logout" size={20} /> Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
