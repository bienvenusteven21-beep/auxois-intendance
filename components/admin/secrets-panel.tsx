"use client";

import { useState } from "react";
import { getSecrets, saveSecrets } from "@/app/actions/proprietes";
import { ActionForm, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { PropertySecretsRow } from "@/lib/types";

export function SecretsPanel({ propertyId }: { propertyId: string }) {
  const [secrets, setSecrets] = useState<PropertySecretsRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(null);
    const res = await getSecrets(propertyId);
    setLoading(false);
    if (res.error) setError(res.error);
    else setSecrets(res.data ?? null);
  }

  return (
    <div className="rounded-2xl border border-bronze-200 bg-bronze-100/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-forest-900 flex items-center gap-2">
            <Icon name="lock" size={18} /> Clés, codes et accès
          </p>
          <p className="text-[13px] text-ink-500 mt-0.5">Réservé au super administrateur et aux intendants. Chaque consultation est journalisée.</p>
        </div>
        {!secrets && (
          <Button variant="bronze" size="sm" icon="eye" onClick={reveal} disabled={loading}>
            {loading ? "…" : "Afficher"}
          </Button>
        )}
        {secrets && !editing && (
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing(true)}>
              Modifier
            </Button>
            <Button variant="ghost" size="sm" icon="eyeOff" onClick={() => setSecrets(null)}>
              Masquer
            </Button>
          </div>
        )}
      </div>
      {error && <p className="text-danger-600 text-[14px] mt-3">{error}</p>}
      {secrets && !editing && (
        <dl className="mt-4 grid sm:grid-cols-2 gap-3 text-[15px]">
          {[
            ["Emplacement des clés", secrets.key_location],
            ["Trousseau", secrets.key_label],
            ["Code alarme", secrets.alarm_code],
            ["Code portail", secrets.gate_code],
            ["Consignes d’accès", secrets.access_notes],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-[13px] text-ink-500">{label}</dt>
              <dd className="text-forest-900 whitespace-pre-line">{value || <span className="text-ink-300">—</span>}</dd>
            </div>
          ))}
        </dl>
      )}
      {secrets && editing && (
        <ActionForm
          action={saveSecrets}
          className="mt-4"
          onSuccess={() => {
            setEditing(false);
            setSecrets(null);
          }}
        >
          <input type="hidden" name="property_id" value={propertyId} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Emplacement des clés" name="key_location" defaultValue={secrets.key_location ?? ""} />
            <Field label="Trousseau" name="key_label" defaultValue={secrets.key_label ?? ""} />
            <Field label="Code alarme" name="alarm_code" defaultValue={secrets.alarm_code ?? ""} />
            <Field label="Code portail" name="gate_code" defaultValue={secrets.gate_code ?? ""} />
          </div>
          <TextArea label="Consignes d’accès" name="access_notes" defaultValue={secrets.access_notes ?? ""} />
          <div className="flex gap-2">
            <SubmitButton full={false} size="md" icon="check">
              Enregistrer
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
