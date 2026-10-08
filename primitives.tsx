import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import type { Tone } from "@/lib/labels";

export function Card({
  children,
  className = "",
  padded = true,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "section" | "div" | "article" | "li";
}) {
  return (
    <Tag className={`bg-white rounded-2xl shadow-soft border border-stone-200/60 ${padded ? "p-5" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

export function CardLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`block bg-white rounded-2xl shadow-soft border border-stone-200/60 p-5 transition hover:border-forest-300 hover:shadow-md active:bg-cream-50 ${className}`}
    >
      {children}
    </Link>
  );
}

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok-100 text-ok-600",
  warn: "bg-warn-100 text-warn-600",
  danger: "bg-danger-100 text-danger-600",
  info: "bg-info-100 text-info-600",
  neutral: "bg-stone-100 text-ink-500",
  bronze: "bg-bronze-100 text-bronze-600",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-ok-600",
  warn: "bg-warn-600",
  danger: "bg-danger-600",
  info: "bg-info-600",
  neutral: "bg-ink-300",
  bronze: "bg-bronze-500",
};

export function Dot({ tone, className = "" }: { tone: Tone; className?: string }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${DOT_CLASS[tone]} ${className}`} />;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label?: string };
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-[15px] text-forest-700 hover:underline mb-2">
          <Icon name="chevronLeft" size={18} /> {back.label ?? "Retour"}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[13px] uppercase tracking-[0.14em] text-bronze-600 font-medium mb-1">{eyebrow}</p>}
          <h1 className="text-[28px] md:text-[34px] leading-tight text-forest-900">{title}</h1>
          {subtitle && <p className="text-ink-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({
  children,
  action,
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-3 ${className}`}>
      <h2 className="text-[13px] uppercase tracking-[0.14em] text-ink-500 font-sans font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon = "leaf",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-cream-50 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-50 text-forest-600">
        <Icon name={icon} />
      </div>
      <p className="font-medium text-forest-900">{title}</p>
      {children && <p className="text-ink-500 text-[15px] mt-1">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "neutral",
  href,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <p className="text-[13px] text-ink-500 leading-tight">{label}</p>
      <p className={`text-[30px] leading-none mt-2 font-serif ${tone === "danger" ? "text-danger-600" : tone === "warn" ? "text-warn-600" : "text-forest-900"}`}>
        {value}
      </p>
      {hint && <p className="text-[12px] text-ink-400 mt-1.5">{hint}</p>}
    </>
  );
  const cls = "rounded-2xl bg-white border border-stone-200/60 shadow-soft p-4 min-h-[96px] flex flex-col justify-between";
  return href ? (
    <Link href={href} className={`${cls} hover:border-forest-300 transition`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Row({
  href,
  icon,
  title,
  subtitle,
  right,
  tone,
}: {
  href?: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  tone?: Tone;
}) {
  const content = (
    <>
      {icon && <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-forest-50 text-forest-700">{icon}</div>}
      {tone && !icon && <Dot tone={tone} className="mt-2" />}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-forest-900 leading-snug">{title}</p>
        {subtitle && <p className="text-[14px] text-ink-500 mt-0.5 leading-snug">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2 text-[14px] text-ink-500">{right}</div>}
      {href && <Icon name="chevron" size={18} className="text-ink-300 shrink-0" />}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-3.5 min-h-[60px]";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-cream-50 active:bg-stone-100 transition`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function List({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-soft border border-stone-200/60 divide-y divide-stone-100 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function Notice({ tone = "info", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 text-[15px] ${TONE_CLASS[tone]} ${className}`}>{children}</div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  const visible = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "");
  if (!visible.length) return null;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {visible.map((i) => (
        <div key={i.label}>
          <dt className="text-[13px] text-ink-500">{i.label}</dt>
          <dd className="text-forest-900 whitespace-pre-line">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
