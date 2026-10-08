"use client";

import { useEffect, useRef, useState } from "react";
import { createObservation } from "@/app/actions/visites";
import { ActionForm, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "@/components/uploads/photo-uploader";
import { OBS_LEVEL } from "@/lib/labels";
import type { ObservationLevel, VisitItemRow } from "@/lib/types";

export function ObservationForm({
  propertyId,
  visitId,
  prefill,
  onClose,
}: {
  propertyId: string;
  visitId?: string | null;
  prefill?: VisitItemRow | null;
  onClose?: () => void;
}) {
  const [level, setLevel] = useState<ObservationLevel>("a_surveiller");
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (prefill) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefill]);

  const needsAction = level === "intervention_recommandee" || level === "urgent";

  return (
    <div ref={ref} className="bg-white rounded-2xl border border-stone-200/60 shadow-soft p-4 scroll-mt-24">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-forest-900">Nouvelle observation</p>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" icon="x" onClick={onClose}>
            Fermer
          </Button>
        )}
      </div>
      <ActionForm
        key={formKey}
        action={createObservation}
        onSuccess={() => {
          setPhotoIds([]);
          setFormKey((k) => k + 1);
          onClose?.();
        }}
      >
        <input type="hidden" name="property_id" value={propertyId} />
        {visitId && <input type="hidden" name="visit_id" value={visitId} />}
        {prefill && <input type="hidden" name="checklist_item_id" value={prefill.id} />}
        {photoIds.map((id) => (
          <input key={id} type="hidden" name="photo_ids" value={id} />
        ))}
        <input type="hidden" name="level" value={level} />

        <div>
          <p className="text-[15px] font-medium text-forest-900 mb-1.5">Niveau</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(OBS_LEVEL) as ObservationLevel[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={`rounded-xl border-2 px-3 py-2.5 text-left text-[14px] leading-tight min-h-[56px] ${level === l ? "border-forest-700 bg-forest-50" : "border-stone-200"}`}
              >
                <span className="font-medium">
                  {OBS_LEVEL[l].emoji} {OBS_LEVEL[l].label}
                </span>
                <span className="block text-[12px] text-ink-500 mt-0.5">{OBS_LEVEL[l].hint}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Titre" name="title" required defaultValue={prefill ? `${prefill.label}${prefill.note ? " — " + prefill.note.slice(0, 40) : ""}` : ""} placeholder="Ex. Chasse d’eau WC étage — fuite légère" />
        <TextArea label="Description" name="description" defaultValue={prefill?.note ?? ""} placeholder="Ce que vous avez constaté, où, depuis quand…" />
        {needsAction && (
          <>
            <TextArea label="Action recommandée" name="recommended_action" rows={2} placeholder="Ex. Intervention plombier recommandée : remplacement du mécanisme de chasse." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Coût estimatif min (€)" name="estimate_min" type="text" inputMode="decimal" placeholder="80" />
              <Field label="Coût estimatif max (€)" name="estimate_max" type="text" inputMode="decimal" placeholder="150" />
            </div>
          </>
        )}
        <div>
          <p className="text-[15px] font-medium text-forest-900 mb-1.5">Photos de l’observation {photoIds.length > 0 && <span className="text-ink-500 font-normal">({photoIds.length} ajoutée{photoIds.length > 1 ? "s" : ""})</span>}</p>
          <PhotoUploader propertyId={propertyId} visitId={visitId} compact onUploaded={(id) => setPhotoIds((p) => [...p, id])} />
        </div>
        <SubmitButton icon="flag">Enregistrer l’observation</SubmitButton>
      </ActionForm>
    </div>
  );
}
