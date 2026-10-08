import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import type { HouseStatus, ObservationRow, VisitItemRow, VisitRow, VisitSummary } from "@/lib/types";
import { HOUSE_STATUS } from "@/lib/labels";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { SummaryTiles } from "@/components/visite/visit-report";
import { finishVisit } from "@/app/actions/visites";

export const metadata = { title: "Terminer la visite" };

export default async function FinishVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: visit } = await supabase.from("visits").select("*, properties(name)").eq("id", id).maybeSingle<VisitRow & { properties: { name: string } | null }>();
  if (!visit) notFound();
  if (visit.status !== "en_cours") redirect(`/admin/visites/${id}`);

  const [{ data: summary }, { data: items }, { data: observations }] = await Promise.all([
    supabase.rpc("visit_summary", { p_visit_id: id }),
    supabase.from("visit_checklist_items").select("*").eq("visit_id", id).returns<VisitItemRow[]>(),
    supabase.from("observations").select("level").eq("visit_id", id).returns<Pick<ObservationRow, "level">[]>(),
  ]);
  const s = summary as VisitSummary | null;
  const temp = items?.find((i) => i.kind === "number" && /temp/i.test(i.label))?.value_number ?? visit.indoor_temperature;
  const mail = items?.find((i) => i.kind === "number" && /courrier/i.test(i.label))?.value_number ?? visit.mail_count;
  const levels = (observations ?? []).map((o) => o.level);
  const suggested: HouseStatus = levels.includes("urgent") ? "urgent" : levels.includes("intervention_recommandee") || (s?.anomalies ?? 0) > 0 ? "vigilance" : "bon";
  const unchecked = s?.non_controles ?? 0;

  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader back={{ href: `/admin/visites/${id}`, label: "Retour à la checklist" }} eyebrow={visit.properties?.name} title="Terminer la visite" subtitle="Vérifiez le résumé, choisissez l’état général et rédigez votre commentaire pour le propriétaire." />

      <div className="mb-6">
        <SummaryTiles summary={s} />
        {unchecked > 0 && (
          <p className="mt-3 rounded-xl bg-warn-100 text-warn-600 px-4 py-2.5 text-[14px]">
            {unchecked} point{unchecked > 1 ? "s" : ""} n’{unchecked > 1 ? "ont" : "a"} pas été contrôlé{unchecked > 1 ? "s" : ""} : {unchecked > 1 ? "ils seront marqués" : "il sera marqué"} « non contrôlé » dans le rapport.
          </p>
        )}
      </div>

      <ActionForm action={finishVisit}>
        <input type="hidden" name="visit_id" value={id} />
        <Card>
          <p className="text-[15px] font-medium text-forest-900 mb-2">État général de la maison</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(HOUSE_STATUS) as HouseStatus[]).map((k) => (
              <label key={k} className="cursor-pointer rounded-2xl border-2 border-stone-200 p-3 text-center has-[:checked]:border-forest-700 has-[:checked]:bg-forest-50 min-h-[88px] flex flex-col items-center justify-center">
                <input type="radio" name="general_status" value={k} defaultChecked={k === suggested} className="sr-only" />
                <span className="text-[28px] leading-none">{HOUSE_STATUS[k].emoji}</span>
                <span className="mt-1.5 font-medium text-[15px]">{HOUSE_STATUS[k].label}</span>
              </label>
            ))}
          </div>
          <p className="text-[13px] text-ink-500 mt-2">Suggestion d’après vos relevés : {HOUSE_STATUS[suggested].emoji} {HOUSE_STATUS[suggested].label}. La pastille de la maison sera mise à jour.</p>
        </Card>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Température intérieure (°C)" name="indoor_temperature" type="text" inputMode="decimal" defaultValue={temp ?? ""} />
            <Field label="Courriers relevés" name="mail_count" type="number" inputMode="numeric" min={0} defaultValue={mail ?? ""} />
          </div>
        </Card>
        <Card>
          <TextArea
            label="Commentaire de l’intendant"
            name="comment"
            rows={6}
            hint="Lu par le propriétaire tel quel. Exemple : « Maison globalement en très bon état. Petite fuite constatée sur la chasse d’eau des WC de l’étage. Je recommande de faire intervenir le plombier. »"
            placeholder="Maison globalement en très bon état…"
          />
        </Card>
        <Checkbox name="send_debrief" defaultChecked label="Envoyer le débrief au propriétaire immédiatement" hint="Il recevra une notification avec l’état général, vos observations et les photos partageables. Décochez pour relire d’abord." />
        <SubmitButton size="xl" icon="flag" pendingText="Enregistrement…">
          Terminer la visite
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
