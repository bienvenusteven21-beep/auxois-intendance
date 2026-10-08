import Link from "next/link";
import { getSettings } from "@/lib/auth";
import type { PropertyRow } from "@/lib/types";
import { Card } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

/** Choisit la maison affichée (paramètre ?maison=…, sinon la première). */
export function pickProperty(properties: PropertyRow[], maison?: string) {
  if (!properties.length) return null;
  return properties.find((p) => p.id === maison) ?? properties[0];
}

export function PropertySwitcher({ properties, current, basePath }: { properties: PropertyRow[]; current: PropertyRow; basePath: string }) {
  if (properties.length < 2) return null;
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-4 px-4">
      {properties.map((p) => (
        <Link key={p.id} href={`${basePath}?maison=${p.id}`} className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-medium ${p.id === current.id ? "bg-forest-800 text-cream" : "bg-white border border-stone-200 text-forest-900"}`}>
          {p.name}
        </Link>
      ))}
    </div>
  );
}

/** Compte sans propriété rattachée : l’équipe doit activer l’espace. */
export async function WaitingForActivation() {
  const settings = await getSettings();
  return (
    <div className="animate-fade-up max-w-lg mx-auto text-center py-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-forest-50 text-forest-700">
        <Icon name="key" size={30} />
      </div>
      <h1 className="text-[28px] text-forest-900 mb-2">Votre espace est en cours d’activation</h1>
      <p className="text-ink-500 mb-6">
        Votre compte est créé. L’équipe {settings.company_name} va le relier à votre maison : vous verrez alors vos visites, vos photos et vos documents ici.
      </p>
      <Card className="text-left text-[15px]">
        <p className="font-medium text-forest-900 mb-1">Besoin d’aide ?</p>
        <p className="text-ink-700">
          {settings.phone && (
            <>
              Téléphone : <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-forest-700 underline">{settings.phone}</a>
              <br />
            </>
          )}
          {settings.email && (
            <>
              Email : <a href={`mailto:${settings.email}`} className="text-forest-700 underline">{settings.email}</a>
            </>
          )}
          {!settings.phone && !settings.email && "Contactez votre intendant."}
        </p>
      </Card>
      <Link href="/client/profil" className="inline-block mt-6 text-forest-700 hover:underline">Mon profil</Link>
    </div>
  );
}
