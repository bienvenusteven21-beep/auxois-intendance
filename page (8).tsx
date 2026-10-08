import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import type { ChecklistTemplateItemRow, ChecklistTemplateRow } from "@/lib/types";
import { Card, List, Notice, PageHeader, Row, SectionTitle } from "@/components/ui/primitives";
import { ChecklistEditor } from "@/components/admin/checklist-editor";

export const metadata = { title: "Checklists" };

export default async function ChecklistsPage() {
  const { supabase } = await requireStaff();
  const { data: templates } = await supabase.from("checklist_templates").select("*, properties(id, name)").order("is_default", { ascending: false }).order("name").returns<(ChecklistTemplateRow & { properties: { id: string; name: string } | null })[]>();
  const def = templates?.find((t) => t.is_default);
  const { data: items } = def ? await supabase.from("checklist_template_items").select("*").eq("template_id", def.id).order("position").returns<ChecklistTemplateItemRow[]>() : { data: [] };
  const custom = (templates ?? []).filter((t) => !t.is_default);
  return (
    <div className="animate-fade-up">
      <PageHeader title="Checklists de visite" subtitle="Le modèle standard s’applique à toutes les maisons sans checklist personnalisée." back={{ href: "/admin/parametres", label: "Paramètres" }} />
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <section>
          <SectionTitle>Modèle standard</SectionTitle>
          {def ? <ChecklistEditor templateId={def.id} items={items ?? []} /> : <Notice tone="danger">Aucun modèle standard : exécutez le fichier d’installation de la base.</Notice>}
        </section>
        <section>
          <SectionTitle>Checklists personnalisées</SectionTitle>
          {custom.length ? (
            <List>
              {custom.map((t) => (
                <Row key={t.id} href={t.properties ? `/admin/proprietes/${t.properties.id}/checklist` : "#"} title={t.name} subtitle={t.properties?.name ?? ""} />
              ))}
            </List>
          ) : (
            <Card className="text-[15px] text-ink-500">
              Aucune. Depuis une <Link href="/admin/proprietes" className="text-forest-700 underline">fiche propriété</Link>, cliquez sur « Personnaliser » pour créer une checklist propre à une maison (piscine, dépendances…).
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
