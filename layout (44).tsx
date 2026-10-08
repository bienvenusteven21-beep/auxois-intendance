import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { getSettings } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-forest-900 text-cream p-12 relative overflow-hidden">
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-forest-800" />
        <div className="absolute right-20 top-24 h-40 w-40 rounded-full bg-bronze-500/20" />
        <div className="relative flex items-center gap-3">
          <BrandMark size={48} />
          <span className="font-serif text-2xl">{settings.company_name}</span>
        </div>
        <div className="relative max-w-md">
          <p className="font-serif text-[44px] leading-[1.1]">{settings.tagline}</p>
          <p className="mt-6 text-forest-200 text-lg leading-relaxed">
            Visites régulières, débriefs avec photos, interventions suivies : même à 400 km, vous savez exactement ce qu’il se passe chez vous.
          </p>
        </div>
        <p className="relative text-forest-300 text-sm">{settings.address ?? "Semur-en-Auxois"}</p>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md animate-fade-up">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <p className="font-serif text-xl text-forest-900">{settings.company_name}</p>
              <p className="text-[13px] text-ink-500">{settings.tagline}</p>
            </div>
          </div>
          {children}
          <p className="mt-10 text-center text-[13px] text-ink-400">
            <Link href="/confidentialite" className="hover:underline">
              Politique de confidentialité
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
