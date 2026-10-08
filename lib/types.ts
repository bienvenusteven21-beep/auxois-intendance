// Types des lignes de la base de données (voir supabase/migrations/0001_schema.sql)

export type Role = "super_admin" | "intendant" | "assistant" | "client";
export type HouseStatus = "bon" | "vigilance" | "urgent";
export type VisitKind = "reguliere" | "preparation" | "controle" | "apres_depart";
export type VisitStatus = "planifiee" | "en_cours" | "terminee" | "annulee";
export type ItemResult = "ok" | "anomalie" | "non_controle";
export type ObservationLevel = "information" | "a_surveiller" | "intervention_recommandee" | "urgent";
export type ObservationStatus =
  | "nouveau" | "en_attente_client" | "autorise" | "artisan_contacte" | "rdv_prevu"
  | "intervention_en_cours" | "resolu" | "classe_sans_suite";
export type ClientDecision = "autorise" | "contacter_avant" | "client_gere";
export type InterventionStatus =
  | "a_planifier" | "artisan_contacte" | "rdv_confirme" | "en_cours" | "terminee" | "annulee";
export type RequestStatus = "nouvelle" | "vue" | "planifiee" | "en_cours" | "terminee";
export type RequestKind = "general" | "sejour" | "contact";
export type StayStatus = "declare" | "preparation_planifiee" | "pret" | "termine" | "annule";
export type SubscriptionStatus = "actif" | "suspendu" | "resilie";
export type Visibility = "interne" | "client";

export interface UserRow {
  id: string;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SettingsRow {
  id: boolean;
  company_name: string;
  tagline: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_path: string | null;
  privacy_policy_version: string;
}

export interface PlanRow {
  id: string;
  code: string;
  name: string;
  monthly_price: number;
  visits_per_year: number;
  included_services: string[];
  position: number;
  is_active: boolean;
}

export interface ClientRow {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  main_address: string | null;
  preferred_language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyRow {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  commune: string | null;
  status: HouseStatus;
  heating_type: string | null;
  boiler: string | null;
  electric_meter: string | null;
  water_meter: string | null;
  water_valve: string | null;
  electrical_panel: string | null;
  internet: string | null;
  special_equipment: string | null;
  outbuildings: string | null;
  pool: string | null;
  gate: string | null;
  garden: string | null;
  usual_tradespeople: string | null;
  insurer: string | null;
  useful_contacts: string | null;
  particular_notes: string | null;
  cover_photo_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertySecretsRow {
  property_id: string;
  key_location: string | null;
  key_label: string | null;
  alarm_code: string | null;
  gate_code: string | null;
  access_notes: string | null;
}

export interface PropertyOwnerRow {
  property_id: string;
  client_id: string;
  is_primary: boolean;
}

export interface PropertyNoteRow {
  id: string;
  property_id: string;
  visibility: Visibility;
  body: string;
  author_id: string | null;
  created_at: string;
}

export interface SubscriptionRow {
  id: string;
  property_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  started_on: string;
  renewal_on: string | null;
  visits_per_year_override: number | null;
  monthly_price_override: number | null;
}

export interface ChecklistTemplateRow {
  id: string;
  name: string;
  property_id: string | null;
  is_default: boolean;
}

export interface ChecklistTemplateItemRow {
  id: string;
  template_id: string;
  category: string;
  label: string;
  kind: "check" | "number";
  unit: string | null;
  position: number;
}

export interface PartnerRow {
  id: string;
  company: string;
  trade: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  zone: string | null;
  internal_notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StayRow {
  id: string;
  property_id: string;
  client_id: string | null;
  arrival_date: string;
  arrival_time: string | null;
  departure_date: string;
  options: string[];
  message: string | null;
  status: StayStatus;
  created_at: string;
}

export interface VisitRow {
  id: string;
  property_id: string;
  kind: VisitKind;
  stay_id: string | null;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  intendant_id: string | null;
  intendant_name: string | null;
  status: VisitStatus;
  general_status: HouseStatus | null;
  intendant_comment: string | null;
  indoor_temperature: number | null;
  mail_count: number | null;
  debrief_sent_at: string | null;
  created_at: string;
}

export interface VisitItemRow {
  id: string;
  visit_id: string;
  category: string;
  label: string;
  kind: "check" | "number";
  unit: string | null;
  position: number;
  result: ItemResult | null;
  value_number: number | null;
  note: string | null;
  checked_at: string | null;
}

export interface ObservationRow {
  id: string;
  property_id: string;
  visit_id: string | null;
  checklist_item_id: string | null;
  title: string;
  description: string | null;
  level: ObservationLevel;
  recommended_action: string | null;
  estimate_min: number | null;
  estimate_max: number | null;
  status: ObservationStatus;
  client_decision: ClientDecision | null;
  client_decision_at: string | null;
  is_shared: boolean;
  observed_at: string;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InterventionRow {
  id: string;
  property_id: string;
  observation_id: string | null;
  partner_id: string | null;
  partner_name: string | null;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  status: InterventionStatus;
  report: string | null;
  final_cost: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface PhotoRow {
  id: string;
  property_id: string;
  visit_id: string | null;
  observation_id: string | null;
  intervention_id: string | null;
  phase: "avant" | "apres" | null;
  category: string | null;
  caption: string | null;
  storage_path: string;
  is_shared: boolean;
  taken_at: string;
  uploaded_by: string | null;
}

export interface ClientRequestRow {
  id: string;
  property_id: string;
  client_id: string | null;
  created_by: string | null;
  kind: RequestKind;
  stay_id: string | null;
  observation_id: string | null;
  subject: string;
  message: string | null;
  status: RequestStatus;
  planned_for: string | null;
  reply: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternalTaskRow {
  id: string;
  title: string;
  notes: string | null;
  due_at: string;
  property_id: string | null;
  assigned_to: string | null;
  is_done: boolean;
}

export interface DocumentCategoryRow {
  id: string;
  name: string;
  position: number;
}

export interface DocumentRow {
  id: string;
  property_id: string | null;
  client_id: string | null;
  visit_id: string | null;
  intervention_id: string | null;
  category_id: string | null;
  title: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  visibility: Visibility;
  uploaded_by: string | null;
  created_at: string;
}

export interface NotificationTemplateRow {
  key: string;
  audience: "client" | "equipe";
  label: string;
  title: string;
  body: string;
  send_push: boolean;
  send_email: boolean;
  is_enabled: boolean;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  template_key: string | null;
  title: string;
  body: string;
  link: string | null;
  property_id: string | null;
  send_push: boolean;
  send_email: boolean;
  read_at: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
  created_at: string;
}

export interface TimelineRow {
  property_id: string;
  happened_at: string;
  kind: "visite" | "observation" | "intervention" | "sejour";
  title: string;
  detail: string | null;
  entity_id: string;
}

export interface VisitSummary {
  points_controles: number;
  points_total: number;
  ok: number;
  anomalies: number;
  non_controles: number;
  observations: number;
  interventions_recommandees: number;
  photos: number;
}

export interface AdminStats {
  proprietes_actives: number;
  clients: number;
  nouveaux_clients_mois: number;
  visites_aujourdhui: number;
  visites_semaine: number;
  visites_realisees: number;
  visites_realisees_mois: number;
  duree_moyenne_visite_min: number | null;
  interventions_ouvertes: number;
  observations_ouvertes: number;
  alertes_urgentes: number;
  demandes_en_attente: number;
  demandes_total: number;
  abonnements: Record<string, number>;
  revenu_mensuel_recurrent: number;
}

export type ActionResult = { ok?: boolean; error?: string; message?: string } | undefined;
