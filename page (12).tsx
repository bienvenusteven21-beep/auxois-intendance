import { requireSuperAdmin } from "@/lib/auth";
import type { NotificationTemplateRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionForm, Checkbox, Field, SubmitButton, TextArea } from "@/components/ui/form";
import { saveNotificationTemplate } from "@/app/actions/parametres";

export const metadata = { title: "Modèles de notifications" };

export default async function NotificationTemplatesPage() {
  const { supabase } = await requireSuperAdmin();
  const { data } = await supabase.from("notification_templates").select("*").order("audience").order("label").returns<NotificationTemplateRow[]>();
  const templates = data ?? [];
  const groups = [
    { key: "client", label: "Envoyées aux propriétaires" },
    { key: "equipe", label: "Envoyées à l’équipe" },
  ];
  return (
    <div className="animate-fade-up">
      <PageHeader title="Modèles de notifications" subtitle="Les textes sont envoyés en notification push, par email et dans l’application." back={{ href: "/admin/parametres", label: "Paramètres" }} />
      <Notice tone="info" className="mb-6">
        Variables disponibles entre doubles accolades, par exemple <code>{"{{maison}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{heure}}"}</code>, <code>{"{{titre}}"}</code>, <code>{"{{client}}"}</code>, <code>{"{{etat}}"}</code>. Elles sont remplacées automatiquement.
      </Notice>
      {groups.map((g) => (
        <section key={g.key} className="mb-8">
          <SectionTitle>{g.label}</SectionTitle>
          <div className="grid lg:grid-cols-2 gap-4">
            {templates
              .filter((t) => t.audience === g.key)
              .map((t) => (
                <Card key={t.key}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-forest-900">{t.label}</p>
                    {!t.is_enabled && <Badge>Désactivée</Badge>}
                  </div>
                  <ActionForm action={saveNotificationTemplate}>
                    <input type="hidden" name="key" value={t.key} />
                    <Field label="Titre" name="title" defaultValue={t.title} required />
                    <TextArea label="Texte" name="body" defaultValue={t.body} rows={3} required />
                    <div className="grid grid-cols-3 gap-2">
                      <Checkbox name="send_push" label="Push" defaultChecked={t.send_push} />
                      <Checkbox name="send_email" label="Email" defaultChecked={t.send_email} />
                      <Checkbox name="is_enabled" label="Active" defaultChecked={t.is_enabled} />
                    </div>
                    <SubmitButton full={false} size="sm" variant="secondary" icon="check">Enregistrer</SubmitButton>
                  </ActionForm>
                </Card>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
