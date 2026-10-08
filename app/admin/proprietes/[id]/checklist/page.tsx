import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";
import { ActionButton } from "@/components/ui/form";
import { ChecklistEditor } from "@/components/admin/checklist-editor";
import { createPropertyChecklist, deletePropertyChecklist } from "@/app/actions/proprietes";
import type { ChecklistTemplateItemRow } from "@/lib/types";

export const metadata = { title: "Checklist de la propriété" };

export default async function PropertyChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: property } = await supabase.from("properties").select("id, name").eq("id", id).maybeSingle();
  if (!property) notFound();
  const { data: tpl } = await supabase.from("checklist_templates").select("id, name").eq("property_id", id).maybeSingle();
  const items = tpl
    ? ((await supabase.from("checklist_template_items").select("*").eq("template_id", tpl.id).order("position")).data as ChecklistTemplateItemRow[] | null) ?? []
    : [];

  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader title="Checklist de visite" subtitle={property.name} back={{ href: `/admin/proprietes/${id}`, label: "Fiche propriété" }} />
      {!tpl ? (
        <Card>
          <p className="text-[15px] text-ink-700 mb-4">
            Cette maison utilise la <strong>checklist standard</strong>. Créez une version personnalisée pour y ajouter des points propres à la maison (piscine, dépendances, alarme…).
          </p>
          <ActionButton action={createPropertyChecklist.bind(null, id)} variant="primary" icon="sparkle">
            Créer une checklist personnalisée (copie du modèle standard)
          </ActionButton>
        </Card>
      ) : (
        <>
          <Notice tone="info" className="mb-4">
            Les modifications s’appliquent aux prochaines visites de cette maison. Les visites déjà commencées gardent leur checklist.
          </Notice>
          <ChecklistEditor templateId={tpl.id} items={items} />
          <div className="mt-6">
            <ActionButton action={deletePropertyChecklist.bind(null, id)} variant="ghost" icon="trash" confirm="Revenir à la checklist standard ? La version personnalisée sera supprimée.">
              Revenir à la checklist standard
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}
