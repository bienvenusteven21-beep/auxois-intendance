import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { getSettings } from "@/lib/auth";

export const metadata = { title: "Politique de confidentialité" };

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="inline-flex items-center gap-3 mb-8">
        <BrandMark size={40} />
        <span className="font-serif text-xl text-forest-900">{s.company_name}</span>
      </Link>
      <h1 className="text-[32px] text-forest-900 mb-2">Politique de confidentialité</h1>
      <p className="text-ink-500 mb-8">Version {s.privacy_policy_version}</p>
      <div className="space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section>
          <h2 className="text-xl text-forest-900 mb-2">Qui est responsable de vos données ?</h2>
          <p>
            {s.company_name}{s.address ? `, ${s.address}` : ""}, est responsable du traitement des données collectées dans cette application.
            {s.email ? ` Contact : ${s.email}.` : ""}
          </p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900 mb-2">Quelles données sont traitées ?</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Votre identité et vos coordonnées (nom, email, téléphone, adresse).</li>
            <li>Les informations relatives à votre propriété nécessaires à l’intendance (adresse, équipements, carnet maison).</li>
            <li>Les comptes rendus de visite, photos, observations, interventions, demandes et documents.</li>
            <li>Les informations d’accès (clés, codes) sont stockées dans un espace réservé, consultable uniquement par les personnes autorisées de l’équipe ; chaque consultation est journalisée.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl text-forest-900 mb-2">Pourquoi ?</h2>
          <p>Pour exécuter le contrat d’intendance : organiser les visites, vous informer de l’état de votre maison, organiser les interventions que vous autorisez et répondre à vos demandes.</p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900 mb-2">Combien de temps ?</h2>
          <p>Pendant la durée du contrat, puis pendant la durée légale de conservation. L’historique de la maison constitue son carnet de santé numérique et vous reste accessible tant que vous êtes client.</p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900 mb-2">Sécurité</h2>
          <p>Les données sont hébergées sur une base sécurisée avec contrôle d’accès strict par rôle. Les photos et documents sont privés : ils ne sont accessibles que par des liens temporaires réservés aux personnes autorisées.</p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900 mb-2">Vos droits</h2>
          <p>
            Vous pouvez à tout moment consulter, exporter ou demander la suppression de vos données depuis la page « Profil » de votre espace, ou en nous contactant.
            Vous pouvez également saisir la CNIL.
          </p>
        </section>
      </div>
    </main>
  );
}
