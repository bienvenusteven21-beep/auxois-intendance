import { fileUrl } from "@/lib/files";
import { formatBytes, formatDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";
import { Icon } from "./ui/icon";
import { Badge, List } from "./ui/primitives";
import { ActionButton } from "./ui/form";
import { deleteDocument } from "@/app/actions/documents";
import Link from "next/link";

export type DocumentWithCategory = DocumentRow & { document_categories?: { name: string } | null; properties?: { name: string } | null };

export function DocumentList({ documents, staff = false, showProperty = false }: { documents: DocumentWithCategory[]; staff?: boolean; showProperty?: boolean }) {
  if (!documents.length) return null;
  return (
    <List>
      {documents.map((d) => (
        <div key={d.id} className="flex items-center gap-3 px-4 py-3 min-h-[60px]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bronze-100 text-bronze-600">
            <Icon name="file" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <a href={fileUrl("documents", d.storage_path, d.title)} target="_blank" rel="noopener" className="font-medium text-forest-900 hover:underline leading-snug block truncate">
              {d.title}
            </a>
            <p className="text-[13px] text-ink-500 truncate">
              {[d.document_categories?.name, showProperty ? d.properties?.name : null, formatDate(d.created_at), formatBytes(d.size_bytes)].filter(Boolean).join(" · ")}
            </p>
          </div>
          {staff && (
            <>
              <Badge tone={d.visibility === "client" ? "ok" : "neutral"}>{d.visibility === "client" ? "Client" : "Interne"}</Badge>
              <Link href={`/admin/documents/${d.id}`} className="text-ink-400 hover:text-forest-800" aria-label="Modifier">
                <Icon name="edit" size={18} />
              </Link>
              <ActionButton action={deleteDocument.bind(null, d.id)} size="sm" variant="ghost" icon="trash" confirm="Supprimer ce document ?" className="text-ink-400">
                <span className="sr-only">Supprimer</span>
              </ActionButton>
            </>
          )}
          {!staff && (
            <a href={fileUrl("documents", d.storage_path, d.title)} className="text-forest-700" aria-label="Télécharger">
              <Icon name="download" size={20} />
            </a>
          )}
        </div>
      ))}
    </List>
  );
}
