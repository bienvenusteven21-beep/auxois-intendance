import { requireSuperAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ROLES } from "@/lib/labels";
import type { Role, UserRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ActionForm, Checkbox, Field, Select, SubmitButton } from "@/components/ui/form";
import { inviteTeamMember, updateUserRole } from "@/app/actions/parametres";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const { supabase, user: me } = await requireSuperAdmin();
  const { data } = await supabase.from("users").select("*").order("role").order("full_name").returns<UserRow[]>();
  const users = data ?? [];
  const team = users.filter((u) => u.role !== "client");
  const clients = users.filter((u) => u.role === "client");
  return (
    <div className="animate-fade-up">
      <PageHeader title="Utilisateurs" subtitle="Membres de l’équipe et comptes propriétaires." back={{ href: "/admin/parametres", label: "Paramètres" }} />
      <Notice tone="info" className="mb-6">
        Rôles : <strong>Super administrateur</strong> (tout, y compris les réglages), <strong>Intendant</strong> (visites, propriétés, clés et codes), <strong>Assistant administratif</strong> (tout sauf les clés et codes et les réglages).
      </Notice>
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6">
          <section>
            <SectionTitle>Équipe</SectionTitle>
            <div className="space-y-3">
              {team.map((u) => (
                <Card key={u.id}>
                  <ActionForm action={updateUserRole}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-medium text-forest-900">{u.full_name || u.email}</p>
                        <p className="text-[13px] text-ink-500">{u.email} · depuis le {formatDate(u.created_at)}</p>
                      </div>
                      <div className="w-56">
                        <Select label="Rôle" name="role" defaultValue={u.role} disabled={u.id === me.id}>
                          {(["super_admin", "intendant", "assistant"] as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLES[r]}
                            </option>
                          ))}
                        </Select>
                        {u.id === me.id && <input type="hidden" name="role" value={u.role} />}
                      </div>
                      <div className="w-44">
                        <Checkbox name="is_active" label="Actif" defaultChecked={u.is_active} />
                      </div>
                      <SubmitButton full={false} size="md" variant="secondary" icon="check">Enregistrer</SubmitButton>
                    </div>
                  </ActionForm>
                </Card>
              ))}
            </div>
          </section>
          <section>
            <SectionTitle>Comptes propriétaires ({clients.length})</SectionTitle>
            <Card className="!p-0 divide-y divide-stone-100">
              {clients.map((u) => (
                <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-forest-900 truncate">{u.full_name || u.email}</p>
                    <p className="text-[13px] text-ink-500 truncate">{u.email}</p>
                  </div>
                  <Badge tone={u.is_active ? "ok" : "neutral"}>{u.is_active ? "Actif" : "Désactivé"}</Badge>
                  <ActionForm action={updateUserRole} className="!space-y-0">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="role" value="client" />
                    {u.is_active ? null : <input type="hidden" name="is_active" value="on" />}
                    <SubmitButton full={false} size="sm" variant="ghost">{u.is_active ? "Désactiver" : "Réactiver"}</SubmitButton>
                  </ActionForm>
                </div>
              ))}
              {clients.length === 0 && <p className="px-4 py-4 text-[15px] text-ink-500">Aucun compte propriétaire. Créez les accès depuis les fiches clients.</p>}
            </Card>
          </section>
        </div>
        <section>
          <SectionTitle>Inviter un membre de l’équipe</SectionTitle>
          <Card>
            <ActionForm action={inviteTeamMember} resetOnSuccess>
              <Field label="Prénom et nom" name="full_name" required />
              <Field label="Email" name="email" type="email" required />
              <Select label="Rôle" name="role" defaultValue="intendant">
                {(["intendant", "assistant", "super_admin"] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r]}
                  </option>
                ))}
              </Select>
              <SubmitButton size="md" icon="plus">Créer le compte</SubmitButton>
              <p className="text-[13px] text-ink-500">Un mot de passe provisoire s’affichera : transmettez-le à la personne, elle pourra le changer depuis son profil.</p>
            </ActionForm>
          </Card>
        </section>
      </div>
    </div>
  );
}
