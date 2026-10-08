import { requireStaff } from "@/lib/auth";
import type { DocumentCategoryRow } from "@/lib/types";
import { Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionButton, ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { deleteDocumentCategory, saveDocumentCategory } from "@/app/actions/parametres";

export const metadata = { title: "Catégories de documents" };

export default async function CategoriesPage() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("document_categories").select("*").order("position").returns<DocumentCategoryRow[]>();
  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader title="Catégories de documents" back={{ href: "/admin/parametres", label: "Paramètres" }} />
      <Card className="!p-0 divide-y divide-stone-100 mb-6">
        {(data ?? []).map((c) => (
          <div key={c.id} className="px-4 py-2">
            <ActionForm action={saveDocumentCategory} className="!space-y-0 flex items-end gap-2">
              <input type="hidden" name="category_id" value={c.id} />
              <div className="flex-1">
                <Field label="" name="name" defaultValue={c.name} required />
              </div>
              <div className="w-24">
                <Field label="" name="position" type="number" defaultValue={c.position} />
              </div>
              <SubmitButton full={false} size="md" variant="secondary" icon="check"><span className="sr-only">Enregistrer</span></SubmitButton>
              <ActionButton action={deleteDocumentCategory.bind(null, c.id)} size="md" variant="ghost" icon="trash" confirm="Supprimer cette catégorie ? Les documents existants la perdront simplement.">
                <span className="sr-only">Supprimer</span>
              </ActionButton>
            </ActionForm>
          </div>
        ))}
      </Card>
      <Card>
        <SectionTitle>Nouvelle catégorie</SectionTitle>
        <ActionForm action={saveDocumentCategory} resetOnSuccess>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Nom" name="name" required placeholder="Ex. Attestation d’assurance" />
            </div>
            <div className="w-28">
              <Field label="Ordre" name="position" type="number" defaultValue={(data?.length ?? 0) + 1} />
            </div>
            <SubmitButton full={false} size="md" icon="plus">Ajouter</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
