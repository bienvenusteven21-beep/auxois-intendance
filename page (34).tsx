import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import type { DocumentRow } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ActionForm, Field, Select, SubmitButton } from "@/components/ui/form";
import { updateDocument } from "@/app/actions/documents";

export default async function DocumentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).maybeSingle<DocumentRow>();
  if (!doc) notFound();
  const { data: cats } = await supabase.from("document_categories").select("id, name").order("position");
  return (
    <div className="animate-fade-up max-w-xl">
      <PageHeader title="Modifier le document" back={{ href: "/admin/documents", label: "Documents" }} />
      <ActionForm action={updateDocument} redirectTo="/admin/documents">
        <input type="hidden" name="document_id" value={doc.id} />
        <Card>
          <Field label="Titre" name="title" required defaultValue={doc.title} />
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <Select label="Catégorie" name="category_id" defaultValue={doc.category_id ?? ""}>
              <option value="">—</option>
              {(cats ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Visibilité" name="visibility" defaultValue={doc.visibility}>
              <option value="client">Visible par le propriétaire</option>
              <option value="interne">Interne (équipe uniquement)</option>
            </Select>
          </div>
          <a href={fileUrl("documents", doc.storage_path)} target="_blank" rel="noopener" className="mt-4 inline-block text-forest-700 hover:underline text-[15px]">
            Ouvrir le fichier
          </a>
        </Card>
        <SubmitButton icon="check">Enregistrer</SubmitButton>
      </ActionForm>
    </div>
  );
}
