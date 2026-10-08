import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { dayBounds } from "@/lib/queries";
import { formatDate, formatTime, fullName, toDateInput, todayParis } from "@/lib/format";
import { INTERVENTION_STATUS, REQUEST_STATUS, VISIT_KIND, VISIT_STATUS } from "@/lib/labels";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { ActionButton, ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/ui/form";
import { deleteInternalTask, saveInternalTask, toggleInternalTask } from "@/app/actions/parametres";
import { startVisit } from "@/app/actions/visites";

export const metadata = { title: "Planning" };

type EventKind = "visite" | "intervention" | "arrivee" | "depart" | "preparation" | "demande" | "tache";

interface CalEvent {
  id: string;
  kind: EventKind;
  date: string; // YYYY-MM-DD
  at: string | null;
  title: string;
  subtitle?: string;
  href?: string;
  status?: string;
  done?: boolean;
  visitId?: string;
  visitStatus?: string;
}

const KIND_STYLE: Record<EventKind, { label: string; chip: string; icon: IconName }> = {
  visite: { label: "Visite", chip: "bg-forest-100 text-forest-900 border-forest-300", icon: "key" },
  preparation: { label: "Préparation", chip: "bg-bronze-100 text-bronze-600 border-bronze-200", icon: "sparkle" },
  intervention: { label: "Intervention artisan", chip: "bg-info-100 text-info-600 border-info-600/30", icon: "wrench" },
  arrivee: { label: "Arrivée client", chip: "bg-ok-100 text-ok-600 border-ok-600/30", icon: "house" },
  depart: { label: "Départ client", chip: "bg-stone-100 text-ink-700 border-stone-300", icon: "logout" },
  demande: { label: "Demande", chip: "bg-warn-100 text-warn-600 border-warn-600/30", icon: "inbox" },
  tache: { label: "Tâche interne", chip: "bg-danger-100 text-danger-600 border-danger-600/30", icon: "flag" },
};

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { first, nextMonth, year: y, month: m };
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ mois?: string; vue?: string; jour?: string }> }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const today = todayParis();
  const month = /^\d{4}-\d{2}$/.test(sp.mois ?? "") ? sp.mois! : today.slice(0, 7);
  const view = sp.vue === "calendrier" ? "calendrier" : "liste";
  const { first, nextMonth, year, month: m } = monthBounds(month);
  const start = dayBounds(first).start;
  const end = dayBounds(nextMonth).start;

  const [visitsRes, intRes, staysRes, reqRes, tasksRes, propsRes] = await Promise.all([
    supabase.from("visits").select("id, scheduled_at, kind, status, properties(name, commune)").neq("status", "annulee").gte("scheduled_at", start).lt("scheduled_at", end).order("scheduled_at"),
    supabase.from("interventions").select("id, scheduled_at, title, status, partner_name, properties(name)").not("scheduled_at", "is", null).neq("status", "annulee").gte("scheduled_at", start).lt("scheduled_at", end),
    supabase.from("stays").select("id, arrival_date, arrival_time, departure_date, status, properties(name), clients(first_name, last_name)").neq("status", "annule").lte("arrival_date", nextMonth).gte("departure_date", first),
    supabase.from("client_requests").select("id, subject, planned_for, status, properties(name)").not("planned_for", "is", null).gte("planned_for", start).lt("planned_for", end),
    supabase.from("internal_tasks").select("id, title, due_at, is_done, notes, properties(name)").gte("due_at", start).lt("due_at", end),
    supabase.from("properties").select("id, name").eq("is_active", true).order("name"),
  ]);

  const name = (p: unknown) => (p as { name: string } | null)?.name ?? "";
  const events: CalEvent[] = [];
  for (const v of visitsRes.data ?? []) {
    events.push({
      id: v.id, kind: v.kind === "preparation" ? "preparation" : "visite", date: toDateInput(v.scheduled_at), at: v.scheduled_at,
      title: name(v.properties), subtitle: `${VISIT_KIND[v.kind as keyof typeof VISIT_KIND]} · ${(v.properties as unknown as { commune: string | null } | null)?.commune ?? ""}`,
      href: `/admin/visites/${v.id}`, status: VISIT_STATUS[v.status as keyof typeof VISIT_STATUS]?.label, visitId: v.id, visitStatus: v.status,
    });
  }
  for (const i of intRes.data ?? []) {
    events.push({ id: i.id, kind: "intervention", date: toDateInput(i.scheduled_at), at: i.scheduled_at, title: i.title, subtitle: `${name(i.properties)}${i.partner_name ? ` · ${i.partner_name}` : ""}`, href: `/admin/interventions/${i.id}`, status: INTERVENTION_STATUS[i.status as keyof typeof INTERVENTION_STATUS]?.label });
  }
  for (const s of staysRes.data ?? []) {
    const who = fullName(s.clients as unknown as { first_name: string; last_name: string } | null);
    if (s.arrival_date >= first && s.arrival_date < nextMonth) events.push({ id: s.id + "a", kind: "arrivee", date: s.arrival_date, at: null, title: `Arrivée ${who}`, subtitle: `${name(s.properties)}${s.arrival_time ? ` · ${s.arrival_time}` : ""}`, href: "/admin/demandes" });
    if (s.departure_date >= first && s.departure_date < nextMonth) events.push({ id: s.id + "d", kind: "depart", date: s.departure_date, at: null, title: `Départ ${who}`, subtitle: name(s.properties), href: "/admin/demandes" });
  }
  for (const r of reqRes.data ?? []) {
    events.push({ id: r.id, kind: "demande", date: toDateInput(r.planned_for), at: r.planned_for, title: r.subject, subtitle: name(r.properties), href: `/admin/demandes/${r.id}`, status: REQUEST_STATUS[r.status as keyof typeof REQUEST_STATUS]?.label });
  }
  for (const t of tasksRes.data ?? []) {
    events.push({ id: t.id, kind: "tache", date: toDateInput(t.due_at), at: t.due_at, title: t.title, subtitle: name(t.properties) || t.notes || undefined, done: t.is_done });
  }
  events.sort((a, b) => (a.date + (a.at ?? "")).localeCompare(b.date + (b.at ?? "")));

  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(`${first}T12:00:00Z`));
  const base = (params: Record<string, string>) => `/admin/planning?${new URLSearchParams({ mois: month, vue: view, ...params }).toString()}`;

  // Grille du calendrier (lundi → dimanche)
  const firstDow = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);

  const selectedDay = sp.jour && /^\d{4}-\d{2}-\d{2}$/.test(sp.jour) ? sp.jour : null;
  const listDays = selectedDay ? [selectedDay] : [...byDay.keys()].sort();

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Planning"
        subtitle="Visites, interventions, arrivées et départs, préparations, demandes et tâches."
        actions={
          <>
            <LinkButton href="/admin/visites/nouvelle" icon="plus">
              Planifier une visite
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1">
          <Link href={base({ mois: shiftMonth(month, -1) })} className={buttonClass("secondary", "sm")} aria-label="Mois précédent">
            <Icon name="chevronLeft" size={18} />
          </Link>
          <span className="font-serif text-xl text-forest-900 capitalize px-2 min-w-[180px] text-center">{monthLabel}</span>
          <Link href={base({ mois: shiftMonth(month, 1) })} className={buttonClass("secondary", "sm")} aria-label="Mois suivant">
            <Icon name="chevron" size={18} />
          </Link>
          <Link href={`/admin/planning?vue=${view}`} className={buttonClass("ghost", "sm")}>
            Aujourd’hui
          </Link>
        </div>
        <div className="flex rounded-xl bg-stone-100 p-1">
          <Link href={base({ vue: "liste" })} className={`px-4 py-1.5 rounded-lg text-[14px] font-medium ${view === "liste" ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>
            <Icon name="list" size={16} className="inline mr-1 -mt-0.5" /> Liste
          </Link>
          <Link href={base({ vue: "calendrier" })} className={`px-4 py-1.5 rounded-lg text-[14px] font-medium ${view === "calendrier" ? "bg-white shadow-soft text-forest-900" : "text-ink-500"}`}>
            <Icon name="grid" size={16} className="inline mr-1 -mt-0.5" /> Calendrier
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5 text-[12px]">
        {(Object.keys(KIND_STYLE) as EventKind[]).map((k) => (
          <span key={k} className={`rounded-full border px-2.5 py-0.5 ${KIND_STYLE[k].chip}`}>
            {KIND_STYLE[k].label}
          </span>
        ))}
      </div>

      {view === "calendrier" && (
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-soft overflow-hidden mb-6">
          <div className="grid grid-cols-7 text-center text-[12px] uppercase tracking-wider text-ink-500 border-b border-stone-200">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dayEvents = day ? byDay.get(day) ?? [] : [];
              const isToday = day === today;
              return (
                <div key={idx} className={`min-h-[76px] md:min-h-[110px] border-b border-r border-stone-100 p-1 md:p-1.5 ${day ? "" : "bg-cream-50"} ${idx % 7 === 6 ? "border-r-0" : ""}`}>
                  {day && (
                    <Link href={base({ vue: "liste", jour: day })} className="block h-full">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px] ${isToday ? "bg-forest-800 text-cream font-semibold" : "text-ink-700"}`}>
                        {Number(day.slice(-2))}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
                          <div key={e.id} className={`truncate rounded border px-1 text-[11px] leading-5 ${KIND_STYLE[e.kind].chip}`}>
                            {e.at ? `${formatTime(e.at)} ` : ""}
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div className="text-[11px] text-ink-400 px-1">+{dayEvents.length - 3}</div>}
                      </div>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "liste" && (
        <div className="space-y-6 mb-8">
          {selectedDay && (
            <div className="flex items-center gap-2 text-[14px]">
              <Link href={base({})} className="text-forest-700 hover:underline">
                ← Tout le mois
              </Link>
            </div>
          )}
          {listDays.length === 0 && <EmptyState icon="calendar" title="Rien de planifié sur cette période" />}
          {listDays.map((day) => {
            const dayEvents = byDay.get(day) ?? [];
            return (
              <section key={day}>
                <SectionTitle>
                  <span className={day === today ? "text-forest-800" : ""}>{formatDate(day, { weekday: true })}</span>
                  {day === today && <Badge tone="ok" className="ml-2">Aujourd’hui</Badge>}
                </SectionTitle>
                {dayEvents.length === 0 && <p className="text-ink-500 text-[15px]">Aucun événement.</p>}
                <div className="space-y-2">
                  {dayEvents.map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Card>
        <details>
          <summary className="cursor-pointer font-medium text-forest-900 flex items-center gap-2">
            <Icon name="flag" size={18} /> Ajouter une tâche interne
          </summary>
          <ActionForm action={saveInternalTask} className="mt-4" resetOnSuccess>
            <Field label="Tâche" name="title" required placeholder="Ex. Commander des étiquettes pour les trousseaux" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" name="date" type="date" required defaultValue={today} />
              <Field label="Heure" name="time" type="time" defaultValue="09:00" />
            </div>
            <Select label="Propriété (facultatif)" name="property_id">
              <option value="">—</option>
              {(propsRes.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <TextArea label="Notes" name="notes" rows={2} />
            <SubmitButton full={false} size="md" icon="plus">
              Ajouter
            </SubmitButton>
          </ActionForm>
        </details>
      </Card>
    </div>
  );
}

function EventRow({ e }: { e: CalEvent }) {
  const style = KIND_STYLE[e.kind];
  const inner = (
    <>
      <div className="w-[56px] shrink-0 text-center">
        <p className="font-serif text-[19px] text-forest-900 leading-none">{e.at ? formatTime(e.at) : "—"}</p>
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${style.chip}`}>
        <Icon name={style.icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium text-forest-900 leading-snug ${e.done ? "line-through text-ink-400" : ""}`}>{e.title}</p>
        <p className="text-[14px] text-ink-500 truncate">
          {style.label}
          {e.subtitle ? ` · ${e.subtitle}` : ""}
        </p>
      </div>
      {e.status && <Badge tone="neutral">{e.status}</Badge>}
    </>
  );
  return (
    <article className="flex items-center gap-3 bg-white rounded-2xl border border-stone-200/60 shadow-soft p-3 pr-4">
      {e.href ? (
        <Link href={e.href} className="flex items-center gap-3 flex-1 min-w-0">
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-3 flex-1 min-w-0">{inner}</div>
      )}
      {e.visitId && (e.visitStatus === "planifiee" || e.visitStatus === "en_cours") && (
        <form action={startVisit.bind(null, e.visitId)}>
          <button className={buttonClass(e.visitStatus === "en_cours" ? "bronze" : "primary", "sm")}>
            <Icon name="play" size={16} /> {e.visitStatus === "en_cours" ? "Reprendre" : "Démarrer"}
          </button>
        </form>
      )}
      {e.kind === "tache" && (
        <div className="flex items-center gap-1">
          <ActionButton action={toggleInternalTask.bind(null, e.id, !e.done)} size="sm" variant="secondary" icon={e.done ? "refresh" : "check"}>
            {e.done ? "Rouvrir" : "Fait"}
          </ActionButton>
          <ActionButton action={deleteInternalTask.bind(null, e.id)} size="sm" variant="ghost" icon="trash" confirm="Supprimer cette tâche ?">
            <span className="sr-only">Supprimer</span>
          </ActionButton>
        </div>
      )}
    </article>
  );
}
