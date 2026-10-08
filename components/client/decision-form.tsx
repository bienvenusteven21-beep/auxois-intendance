"use client";

import { useState } from "react";
import { decideObservation } from "@/app/actions/client";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";

/** Les trois boutons de décision du propriétaire sur une intervention recommandée. */
export function DecisionForm({ observationId }: { observationId: string }) {
  const [choice, setChoice] = useState<"autorise" | "contacter_avant" | "client_gere" | null>(null);
  return (
    <ActionForm action={decideObservation} className="mt-4">
      <input type="hidden" name="observation_id" value={observationId} />
      <input type="hidden" name="decision" value={choice ?? ""} />
      <div className="space-y-2">
        <button type="button" onClick={() => setChoice("autorise")} className={`w-full rounded-2xl border-2 px-4 py-4 text-left flex items-center gap-3 min-h-[64px] ${choice === "autorise" ? "border-forest-700 bg-forest-50" : "border-stone-200 bg-white"}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok-100 text-ok-600"><Icon name="check" size={22} strokeWidth={2.4} /></span>
          <span className="font-medium text-forest-900 text-[16px]">Autoriser Auxois Intendance à organiser l’intervention</span>
        </button>
        <button type="button" onClick={() => setChoice("contacter_avant")} className={`w-full rounded-2xl border-2 px-4 py-4 text-left flex items-center gap-3 min-h-[64px] ${choice === "contacter_avant" ? "border-forest-700 bg-forest-50" : "border-stone-200 bg-white"}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-100 text-info-600"><Icon name="phone" size={20} /></span>
          <span className="font-medium text-forest-900 text-[16px]">Me contacter avant</span>
        </button>
        <button type="button" onClick={() => setChoice("client_gere")} className={`w-full rounded-2xl border-2 px-4 py-4 text-left flex items-center gap-3 min-h-[64px] ${choice === "client_gere" ? "border-forest-700 bg-forest-50" : "border-stone-200 bg-white"}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-ink-500"><Icon name="user" size={20} /></span>
          <span className="font-medium text-forest-900 text-[16px]">Je m’en occupe moi-même</span>
        </button>
      </div>
      {choice === "contacter_avant" && <TextArea label="Un message pour nous ? (facultatif)" name="message" rows={2} placeholder="Quand et comment vous joindre…" />}
      {choice && (
        <SubmitButton size="lg" icon="send">
          Confirmer mon choix
        </SubmitButton>
      )}
    </ActionForm>
  );
}
