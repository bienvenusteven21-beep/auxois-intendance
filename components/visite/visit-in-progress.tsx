"use client";

import { useState } from "react";
import Link from "next/link";
import { VisitChecklist } from "./checklist";
import { ObservationForm } from "./observation-form";
import { PhotoGrid } from "@/components/photos";
import { PhotoUploader } from "@/components/uploads/photo-uploader";
import { ObservationCard } from "@/components/observation-card";
import { Button, LinkButton } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { ActionForm, Field, Select, SubmitButton } from "@/components/ui/form";
import { addChecklistItem } from "@/app/actions/visites";
import type { ObservationRow, PhotoRow, VisitItemRow } from "@/lib/types";

export function VisitInProgress({
  visitId,
  propertyId,
  items,
  observations,
  photos,
}: {
  visitId: string;
  propertyId: string;
  items: VisitItemRow[];
  observations: ObservationRow[];
  photos: PhotoRow[];
}) {
  const [obsOpen, setObsOpen] = useState(false);
  const [prefill, setPrefill] = useState<VisitItemRow | null>(null);
  const [tab, setTab] = useState<"checklist" | "photos" | "observations">("checklist");

  const counts = { photos: photos.length, observations: observations.length };

  return (
    <div className="space-y-5">
      <div className="flex rounded-xl bg-stone-100 p-1 text-[14px] font-medium">
        {(
          [
            ["checklist", "Checklist"],
            ["photos", `Photos${counts.photos ? ` (${counts.photos})` : ""}`],
            ["observations", `Observations${counts.observations ? ` (${counts.observations})` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`flex-1 rounded-lg py-2.5 ${tab === key ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "checklist" && (
        <>
          <VisitChecklist
            key={items.map((i) => i.id).join(",")}
            items={items}
            onCreateObservation={(item) => {
              setPrefill(item);
              setObsOpen(true);
              setTab("observations");
            }}
          />
          <details className="bg-white rounded-2xl border border-stone-200/60 p-4">
            <summary className="cursor-pointer text-[15px] text-forest-700">Ajouter un point à contrôler (pour cette visite seulement)</summary>
            <ActionForm action={addChecklistItem} className="mt-3" resetOnSuccess>
              <input type="hidden" name="visit_id" value={visitId} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Catégorie" name="category" required placeholder="Ex. Piscine" />
                <Field label="Intitulé" name="label" required placeholder="Ex. Niveau d’eau" />
                <Select label="Type" name="kind">
                  <option value="check">À cocher</option>
                  <option value="number">Valeur</option>
                </Select>
                <Field label="Unité" name="unit" placeholder="°C…" />
              </div>
              <SubmitButton full={false} size="md" icon="plus">Ajouter</SubmitButton>
            </ActionForm>
          </details>
        </>
      )}

      {tab === "photos" && (
        <div className="space-y-4">
          <PhotoUploader propertyId={propertyId} visitId={visitId} />
          <PhotoGrid photos={photos} staff />
          {photos.length === 0 && <p className="text-ink-500 text-[15px] text-center py-6">Aucune photo pour l’instant. Pensez aux extérieurs, à la chaudière et aux compteurs.</p>}
        </div>
      )}

      {tab === "observations" && (
        <div className="space-y-4">
          {!obsOpen && (
            <Button
              variant="bronze"
              size="lg"
              icon="flag"
              full
              onClick={() => {
                setPrefill(null);
                setObsOpen(true);
              }}
            >
              Créer une observation
            </Button>
          )}
          {obsOpen && (
            <ObservationForm
              propertyId={propertyId}
              visitId={visitId}
              prefill={prefill}
              onClose={() => {
                setObsOpen(false);
                setPrefill(null);
              }}
            />
          )}
          {observations.length > 0 && <SectionTitle>Observations de cette visite</SectionTitle>}
          {observations.map((o) => (
            <ObservationCard key={o.id} o={o} staff href={`/admin/observations/${o.id}`}>
              <div className="mt-3">
                <Link href={`/admin/observations/${o.id}`} className="text-[14px] text-forest-700 hover:underline inline-flex items-center gap-1">
                  Modifier <Icon name="chevron" size={14} />
                </Link>
              </div>
            </ObservationCard>
          ))}
        </div>
      )}

      {/* Barre d’action fixe */}
      <div className="fixed bottom-[76px] lg:bottom-6 inset-x-4 lg:inset-x-auto lg:right-10 lg:w-96 z-20">
        <LinkButton href={`/admin/visites/${visitId}/terminer`} variant="primary" size="xl" full icon="flag" className="shadow-xl">
          Terminer la visite
        </LinkButton>
      </div>
      <div className="h-20" />
    </div>
  );
}
