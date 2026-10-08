import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "bronze" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-forest-800 text-cream hover:bg-forest-700 active:bg-forest-900 shadow-soft",
  secondary: "bg-stone-100 text-forest-900 hover:bg-stone-200 active:bg-stone-300",
  outline: "border border-forest-800/30 text-forest-900 bg-transparent hover:bg-forest-50",
  ghost: "text-forest-800 hover:bg-forest-50",
  danger: "bg-danger-600 text-white hover:bg-red-800",
  bronze: "bg-bronze-500 text-white hover:bg-bronze-600 shadow-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-13 min-h-[52px] px-5 text-base gap-2.5 rounded-xl",
  xl: "min-h-[64px] px-6 text-lg gap-3 rounded-2xl",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none select-none ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  className?: string;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  full,
  className = "",
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClass(variant, size, `${full ? "w-full" : ""} ${className}`)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 16 : 20} />}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  full,
  className = "",
  children,
}: Common & { href: string }) {
  return (
    <Link href={href} className={buttonClass(variant, size, `${full ? "w-full" : ""} ${className}`)}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 16 : 20} />}
    </Link>
  );
}
