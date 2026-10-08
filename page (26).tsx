import { requireStaff } from "@/lib/auth";
import { todayParis } from "@/lib/format";
import { VISIT_KIND } from "@/lib/labels";
import { ActionForm, Field, Select, SubmitButton } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { scheduleVisit } from "@/app/actions/visites";

export const metadata = { title: "Planifier une visite" };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ propriete?: string; sejour?: string; date?: string }> }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const { data: properties } = await supabase.from("properties").select("id, name, commune").eq("is_active", true).order("name");
  return (
    <div className="animate-fade-up max-w-xl">
      <PageHeader title="Planifier une visite" back={{ href: "/admin/planning", label: "Planning" }} />
      <ActionForm action={scheduleVisit}>
        {sp.sejour && <input type="hidden" name="stay_id" value={sp.sejour} />}
        <input type="hidden" name="redirect" value={sp.propriete ? `/admin/proprietes/${sp.propriete}` : "/admin/planning"} />
        <Card>
          <Select label="Propriété" name="property_id" required defaultValue={sp.propriete ?? ""}>
            <option value="">— Choisir —</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.commune ? ` (${p.commune})` : ""}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Field label="Date" name="date" type="date" required defaultValue={sp.date ?? todayParis()} />
            <Field label="Heure" name="time" type="time" defaultValue="10:00" />
          </div>
          <div className="mt-4">
            <Select label="Type de visite" name="kind" defaultValue={sp.sejour ? "preparation" : "reguliere"}>
              {Object.entries(VISIT_KIND).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-[13px] text-ink-500 mt-3">Le propriétaire est prévenu de la date prévue. La prochaine visite régulière sera ensuite proposée automatiquement selon sa formule.</p>
        </Card>
        <SubmitButton icon="calendar">Planifier</SubmitButton>
      </ActionForm>
    </div>
  );
}
