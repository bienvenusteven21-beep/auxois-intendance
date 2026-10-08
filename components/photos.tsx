import { fileUrl } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import type { PhotoRow } from "@/lib/types";
import { Icon } from "./ui/icon";
import { ActionButton } from "./ui/form";
import { deletePhoto, updatePhoto } from "@/app/actions/visites";

export function PhotoGrid({
  photos,
  staff = false,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
}: {
  photos: Pick<PhotoRow, "id" | "storage_path" | "caption" | "category" | "is_shared" | "taken_at" | "phase">[];
  staff?: boolean;
  columns?: string;
}) {
  if (!photos.length) return null;
  return (
    <ul className={`grid ${columns} gap-3`}>
      {photos.map((p) => (
        <li key={p.id} className="group relative overflow-hidden rounded-2xl bg-stone-100 border border-stone-200/60">
          <a href={fileUrl("photos", p.storage_path)} target="_blank" rel="noopener" className="block aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl("photos", p.storage_path)} alt={p.caption ?? p.category ?? "Photo"} loading="lazy" className="h-full w-full object-cover" />
          </a>
          <div className="px-3 py-2 text-[13px] leading-snug">
            <p className="text-forest-900 font-medium truncate">{p.caption || p.category || "Photo"}</p>
            <p className="text-ink-400 truncate">
              {p.phase ? (p.phase === "avant" ? "Avant · " : "Après · ") : ""}
              {formatDateTime(p.taken_at)}
            </p>
          </div>
          {staff && (
            <div className="flex items-center justify-between gap-1 px-2 pb-2">
              <ActionButton action={updatePhoto.bind(null, p.id, { is_shared: !p.is_shared })} size="sm" variant={p.is_shared ? "ghost" : "secondary"} icon={p.is_shared ? "eye" : "eyeOff"} className="text-[12px]">
                {p.is_shared ? "Partagée" : "Interne"}
              </ActionButton>
              <ActionButton action={deletePhoto.bind(null, p.id)} size="sm" variant="ghost" icon="trash" confirm="Supprimer cette photo ?" className="text-ink-400">
                <span className="sr-only">Supprimer</span>
              </ActionButton>
            </div>
          )}
          {!p.is_shared && (
            <span className="absolute top-2 left-2 rounded-full bg-ink-900/70 text-white text-[11px] px-2 py-0.5 flex items-center gap-1">
              <Icon name="lock" size={12} /> interne
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
