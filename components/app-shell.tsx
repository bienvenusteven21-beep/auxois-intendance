"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "./brand";
import { Icon, type IconName } from "./ui/icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export function AppShell({
  items,
  mobileItems,
  user,
  companyName,
  unread,
  signOutAction,
  accent = "forest",
  children,
}: {
  items: NavItem[];
  /** Les 4 onglets visibles dans la barre basse (le reste passe dans « Plus »). */
  mobileItems: string[];
  user: { name: string; role: string };
  companyName: string;
  unread: number;
  signOutAction: () => Promise<void>;
  accent?: "forest" | "cream";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);

  const isActive = (href: string) => (href === items[0].href ? pathname === href : pathname.startsWith(href));
  const primary = items.filter((i) => mobileItems.includes(i.href));
  const secondary = items.filter((i) => !mobileItems.includes(i.href));
  const notifHref = items[0].href + "/notifications";

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barre latérale (ordinateur) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-forest-900 text-cream sticky top-0 h-dvh">
        <Link href={items[0].href} className="flex items-center gap-3 px-5 py-6">
          <BrandMark size={40} />
          <div className="leading-tight">
            <p className="font-serif text-lg">{companyName}</p>
            <p className="text-[12px] text-forest-300">{user.role}</p>
          </div>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
                isActive(item.href) ? "bg-forest-800 text-white" : "text-forest-200 hover:bg-forest-800/60 hover:text-white"
              }`}
            >
              <Icon name={item.icon} size={20} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span className="rounded-full bg-bronze-500 px-2 py-0.5 text-[12px] text-white">{item.badge}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-forest-800 space-y-0.5">
          <Link href={notifHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-forest-200 hover:bg-forest-800/60 hover:text-white">
            <Icon name="bell" size={20} />
            <span className="flex-1">Notifications</span>
            {unread > 0 && <span className="rounded-full bg-bronze-500 px-2 py-0.5 text-[12px] text-white">{unread}</span>}
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 text-[14px] text-forest-200">
            <Icon name="user" size={20} />
            <span className="flex-1 truncate">{user.name}</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-forest-200 hover:bg-forest-800/60 hover:text-white">
              <Icon name="logout" size={20} />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barre haute (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 bg-cream/90 backdrop-blur border-b border-stone-200">
          <div className="flex items-center justify-between px-4 h-14">
            <Link href={items[0].href} className="flex items-center gap-2.5">
              <BrandMark size={32} />
              <span className="font-serif text-[17px] text-forest-900">{companyName}</span>
            </Link>
            <Link href={notifHref} className="relative flex h-10 w-10 items-center justify-center rounded-full text-forest-800 hover:bg-stone-100" aria-label="Notifications">
              <Icon name="bell" size={22} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-bronze-500 px-1 text-[11px] font-semibold text-white flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className={`flex-1 px-4 pt-5 lg:px-10 lg:pt-10 pb-nav mx-auto w-full max-w-6xl ${accent === "cream" ? "" : ""}`}>{children}</main>

        {/* Barre basse (mobile) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-stone-200 safe-bottom">
          <ul className="grid grid-cols-5">
            {primary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium ${
                    isActive(item.href) ? "text-forest-800" : "text-ink-400"
                  }`}
                >
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full ${isActive(item.href) ? "bg-forest-100" : ""}`}>
                    <Icon name={item.icon} size={22} />
                  </span>
                  {item.label}
                  {item.badge ? <span className="absolute top-1.5 right-3 min-w-[18px] h-[18px] rounded-full bg-bronze-500 px-1 text-[11px] text-white flex items-center justify-center">{item.badge}</span> : null}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex w-full flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium ${moreOpen ? "text-forest-800" : "text-ink-400"}`}
              >
                <span className={`flex h-8 w-12 items-center justify-center rounded-full ${moreOpen ? "bg-forest-100" : ""}`}>
                  <Icon name="menu" size={22} />
                </span>
                Plus
              </button>
            </li>
          </ul>
        </nav>

        {/* Panneau « Plus » */}
        {moreOpen && (
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
            <div className="absolute inset-0 bg-forest-950/40" />
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 safe-bottom animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-300" />
              <ul className="grid grid-cols-2 gap-2">
                {secondary.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 min-h-[56px] ${isActive(item.href) ? "bg-forest-100 text-forest-900" : "bg-cream text-forest-900"}`}>
                      <Icon name={item.icon} size={22} />
                      <span className="flex-1 text-[15px]">{item.label}</span>
                      {item.badge ? <span className="rounded-full bg-bronze-500 px-2 py-0.5 text-[12px] text-white">{item.badge}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between px-2 text-[14px] text-ink-500">
                <span className="truncate">{user.name}</span>
                <form action={signOutAction}>
                  <button type="submit" className="inline-flex items-center gap-2 text-forest-800 font-medium py-2">
                    <Icon name="logout" size={18} /> Se déconnecter
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
