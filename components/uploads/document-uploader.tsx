"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDocumentRecord } from "@/app/actions/documents";
import { Icon } from "@/components/ui/icon";

export function DocumentUploader({
  propertyId,
  clientId,
  visitId,
  interventionId,
  categories,
  properties,
  clients,
}: {
  propertyId?: string | null;
  clientId?: string | null;
  visitId?: string | null;
  interventionId?: string | null;
  categories: { id: string; name: string }[];
  /** Si fournis, l’utilisateur choisit le rattachement. */
  properties?: { id: string; name: string }[];
  clients?: { id: string; first_name: string; last_name: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState<"interne" | "client">("client");
  const [target, setTarget] = useState<string>(propertyId ? `p:${propertyId}` : clientId ? `c:${clientId}` : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return setError("Choisissez un fichier.");
    const [kind, id] = target.split(":");
    const pId = kind === "p" ? id : null;
    const cId = kind === "c" ? id : null;
    if (!pId && !cId) return setError("Rattachez le document à une propriété ou à un client.");
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const supabase = createClient();
      const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${pId ?? `client-${cId}`}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const res = await addDocumentRecord({
        title: title || file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        property_id: pId,
        client_id: cId,
        visit_id: visitId ?? null,
        intervention_id: interventionId ?? null,
        category_id: categoryId || null,
        visibility,
      });
      if (res?.error) throw new Error(res.error);
      setOk("Document ajouté.");
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] min-h-[48px]";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-forest-300 bg-forest-50/60 p-4 space-y-3">
      <input ref={inputRef} type="file" className="block w-full text-[15px] file:mr-3 file:rounded-lg file:border-0 file:bg-forest-800 file:text-cream file:px-3 file:py-2" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du document (sinon : nom du fichier)" className={input} />
      {(properties || clients) && (
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={input}>
          <option value="">Rattacher à…</option>
          {properties?.length ? (
            <optgroup label="Propriétés">
              {properties.map((p) => (
                <option key={p.id} value={`p:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {clients?.length ? (
            <optgroup label="Clients (sans propriété)">
              {clients.map((c) => (
                <option key={c.id} value={`c:${c.id}`}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
          <option value="">Catégorie (facultatif)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as "interne" | "client")} className={input}>
          <option value="client">Visible par le propriétaire</option>
          <option value="interne">Interne (équipe uniquement)</option>
        </select>
      </div>
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-forest-800 text-cream px-4 min-h-[48px] font-medium disabled:opacity-50">
        <Icon name="upload" size={18} /> {busy ? "Envoi…" : "Déposer le document"}
      </button>
      {error && <p className="text-danger-600 text-[14px]">{error}</p>}
      {ok && <p className="text-ok-600 text-[14px]">{ok}</p>}
    </form>
  );
}
