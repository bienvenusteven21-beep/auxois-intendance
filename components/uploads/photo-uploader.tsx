"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addPhotoRecord } from "@/app/actions/visites";
import { Icon } from "@/components/ui/icon";
import { PHOTO_CATEGORIES } from "@/lib/labels";

/** Réduit la photo (max 1600 px, JPEG) pour un envoi rapide depuis le téléphone. */
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function PhotoUploader({
  propertyId,
  visitId,
  interventionId,
  observationId,
  phase,
  defaultShared = true,
  compact = false,
  onUploaded,
}: {
  propertyId: string;
  visitId?: string | null;
  interventionId?: string | null;
  observationId?: string | null;
  phase?: "avant" | "apres" | null;
  defaultShared?: boolean;
  compact?: boolean;
  onUploaded?: (id: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [shared, setShared] = useState(defaultShared);
  const [caption, setCaption] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createClient();
    let i = 0;
    for (const file of Array.from(files)) {
      i += 1;
      setBusy(files.length > 1 ? `Envoi ${i}/${files.length}…` : "Envoi…");
      try {
        const blob = await compressImage(file);
        const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${propertyId}/${visitId ?? interventionId ?? "photo"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("photos").upload(path, blob, { contentType: blob.type || file.type, upsert: false });
        if (upErr) throw upErr;
        const res = await addPhotoRecord({
          property_id: propertyId,
          storage_path: path,
          visit_id: visitId ?? null,
          intervention_id: interventionId ?? null,
          observation_id: observationId ?? null,
          phase: phase ?? null,
          category: category || null,
          caption: caption || null,
          is_shared: shared,
        });
        if (res?.error) throw new Error(res.error);
        if (res?.id) onUploaded?.(res.id);
      } catch (e) {
        setError((e as Error).message || "Envoi impossible.");
      }
    }
    setBusy(null);
    setCaption("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className={`rounded-2xl border border-dashed border-forest-300 bg-forest-50/60 ${compact ? "p-3" : "p-4"}`}>
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] min-h-[48px]">
            <option value="">Catégorie (facultatif)</option>
            {PHOTO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Légende (facultatif)" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] min-h-[48px]" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" id={inputId} onChange={(e) => handleFiles(e.target.files)} />
        <label htmlFor={inputId} className="inline-flex items-center gap-2 rounded-xl bg-forest-800 text-cream px-4 min-h-[48px] font-medium cursor-pointer hover:bg-forest-700">
          <Icon name="camera" size={20} />
          {busy ?? "Prendre / ajouter des photos"}
        </label>
        <label className="inline-flex items-center gap-2 text-[14px] text-ink-700 cursor-pointer">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-5 w-5 accent-forest-700" />
          Visible par le propriétaire
        </label>
      </div>
      {!shared && <p className="text-[13px] text-bronze-600 mt-2">Photo interne : réservée à l’équipe.</p>}
      {error && <p className="text-danger-600 text-[14px] mt-2">{error}</p>}
    </div>
  );
}
