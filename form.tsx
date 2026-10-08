"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import type { IconName } from "./icon";
import type { ActionResult } from "@/lib/types";

const inputBase =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[17px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-forest-400 min-h-[52px] disabled:bg-stone-100";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[15px] font-medium text-forest-900 mb-1.5">
      {children}
      {hint && <span className="block text-[13px] font-normal text-ink-500">{hint}</span>}
    </label>
  );
}

export function Field({
  label,
  name,
  hint,
  className = "",
  ...rest
}: { label: ReactNode; name: string; hint?: ReactNode; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name} hint={hint}>
        {label}
      </Label>
      <input id={name} name={name} className={inputBase} {...rest} />
    </div>
  );
}

export function TextArea({
  label,
  name,
  hint,
  className = "",
  ...rest
}: { label: ReactNode; name: string; hint?: ReactNode; className?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name} hint={hint}>
        {label}
      </Label>
      <textarea id={name} name={name} rows={3} className={`${inputBase} leading-relaxed`} {...rest} />
    </div>
  );
}

export function Select({
  label,
  name,
  hint,
  className = "",
  children,
  ...rest
}: { label: ReactNode; name: string; hint?: ReactNode; className?: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name} hint={hint}>
        {label}
      </Label>
      <div className="relative">
        <select id={name} name={name} className={`${inputBase} appearance-none pr-10`} {...rest}>
          {children}
        </select>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c646c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

export function Checkbox({
  label,
  name,
  value,
  defaultChecked,
  hint,
}: {
  label: ReactNode;
  name: string;
  value?: string;
  defaultChecked?: boolean;
  hint?: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 min-h-[52px] cursor-pointer has-[:checked]:border-forest-500 has-[:checked]:bg-forest-50">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="mt-1 h-5 w-5 accent-forest-700 shrink-0" />
      <span>
        <span className="text-forest-900">{label}</span>
        {hint && <span className="block text-[13px] text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "lg",
  icon,
  full = true,
  pendingText = "Un instant…",
  className = "",
  formAction,
  name,
  value,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  full?: boolean;
  pendingText?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} icon={pending ? undefined : icon} full={full} disabled={pending} className={className} formAction={formAction} name={name} value={value}>
      {pending ? pendingText : children}
    </Button>
  );
}

/**
 * Formulaire relié à une action serveur renvoyant { ok, error, message }.
 * Affiche l’erreur ou le message, et redirige si demandé.
 */
export function ActionForm({
  action,
  children,
  className = "",
  successMessage,
  redirectTo,
  resetOnSuccess,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  successMessage?: string;
  redirectTo?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      onSuccess?.();
      if (resetOnSuccess) setFormKey((k) => k + 1);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className={`space-y-4 ${className}`} key={formKey}>
      {children}
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-100 text-danger-600 px-4 py-3 text-[15px]">
          {state.error}
        </p>
      )}
      {state?.ok && (state.message || successMessage) && (
        <p role="status" className="rounded-xl bg-ok-100 text-ok-600 px-4 py-3 text-[15px]">
          {state.message ?? successMessage}
        </p>
      )}
    </form>
  );
}

/** Bouton seul relié à une action (ex. changer un statut), avec confirmation facultative. */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "secondary",
  size = "md",
  icon,
  full,
  className = "",
  redirectTo,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  confirm?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  full?: boolean;
  className?: string;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState(async () => {
    if (confirm && !window.confirm(confirm)) return undefined;
    return action();
  }, undefined as ActionResult);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className={full ? "w-full" : "inline"}>
      <Button type="submit" variant={variant} size={size} icon={icon} full={full} disabled={pending} className={className}>
        {pending ? "…" : children}
      </Button>
      {state?.error && <p className="text-danger-600 text-[14px] mt-1">{state.error}</p>}
    </form>
  );
}
