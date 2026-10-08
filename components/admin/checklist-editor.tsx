import { ActionButton, ActionForm, Field, Select, SubmitButton } from "@/components/ui/form";
import { Card } from "@/components/ui/primitives";
import { addTemplateItem, deleteTemplateItem, moveTemplateItem } from "@/app/actions/proprietes";
import type { ChecklistTemplateItemRow } from "@/lib/types";

export function ChecklistEditor({ templateId, items }: { templateId: string; items: ChecklistTemplateItemRow[] }) {
  const categories = [...new Set(items.map((i) => i.category))];
  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <Card key={cat} className="!p-0 overflow-hidden">
          <p className="px-4 py-2.5 bg-forest-50 text-[13px] uppercase tracking-[0.12em] font-semibold text-forest-800">{cat}</p>
          <ul className="divide-y divide-stone-100">
            {items
              .filter((i) => i.category === cat)
              .map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-4 py-2 text-[15px]">
                  <span className="flex-1">
                    {i.label}
                    {i.kind === "number" && <span className="text-ink-400 text-[13px]"> · valeur{i.unit ? ` en ${i.unit}` : ""}</span>}
                  </span>
                  <ActionButton action={moveTemplateItem.bind(null, i.id, "up")} size="sm" variant="ghost" icon="chevronDown" className="rotate-180">
                    <span className="sr-only">Monter</span>
                  </ActionButton>
                  <ActionButton action={moveTemplateItem.bind(null, i.id, "down")} size="sm" variant="ghost" icon="chevronDown">
                    <span className="sr-only">Descendre</span>
                  </ActionButton>
                  <ActionButton action={deleteTemplateItem.bind(null, i.id)} size="sm" variant="ghost" icon="trash" confirm="Retirer ce point ?">
                    <span className="sr-only">Supprimer</span>
                  </ActionButton>
                </li>
              ))}
          </ul>
        </Card>
      ))}
      <Card>
        <p className="font-medium text-forest-900 mb-3">Ajouter un point de contrôle</p>
        <ActionForm action={addTemplateItem} resetOnSuccess>
          <input type="hidden" name="template_id" value={templateId} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Catégorie" name="category" required list="categories" placeholder="Ex. Piscine" />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Field label="Intitulé" name="label" required placeholder="Ex. Niveau d’eau" />
            <Select label="Type" name="kind">
              <option value="check">À cocher (OK / anomalie)</option>
              <option value="number">Valeur à relever</option>
            </Select>
            <Field label="Unité (si valeur)" name="unit" placeholder="°C, bar, courrier(s)…" />
          </div>
          <SubmitButton full={false} size="md" icon="plus">Ajouter</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
