import type {
  HouseStatus, InterventionStatus, ObservationLevel, ObservationStatus, RequestStatus,
  Role, StayStatus, VisitKind, VisitStatus,
} from "./types";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "bronze";

export const HOUSE_STATUS: Record<HouseStatus, { label: string; short: string; emoji: string; tone: Tone; client: string }> = {
  bon: { label: "Bon", short: "BON", emoji: "🟢", tone: "ok", client: "Votre maison va bien." },
  vigilance: { label: "Vigilance", short: "VIGILANCE", emoji: "🟠", tone: "warn", client: "Un point mérite votre attention." },
  urgent: { label: "Urgent", short: "URGENT", emoji: "🔴", tone: "danger", client: "Une intervention urgente est en cours." },
};

export const ROLES: Record<Role, string> = {
  super_admin: "Super administrateur",
  intendant: "Intendant",
  assistant: "Assistant administratif",
  client: "Propriétaire",
};

export const VISIT_KIND: Record<VisitKind, string> = {
  reguliere: "Visite régulière",
  preparation: "Préparation avant arrivée",
  controle: "Visite de contrôle",
  apres_depart: "Contrôle après départ",
};

export const VISIT_STATUS: Record<VisitStatus, { label: string; tone: Tone }> = {
  planifiee: { label: "Planifiée", tone: "info" },
  en_cours: { label: "En cours", tone: "warn" },
  terminee: { label: "Terminée", tone: "ok" },
  annulee: { label: "Annulée", tone: "neutral" },
};

export const OBS_LEVEL: Record<ObservationLevel, { label: string; emoji: string; tone: Tone; hint: string }> = {
  information: { label: "Information", emoji: "🔵", tone: "info", hint: "Simple information, rien à faire." },
  a_surveiller: { label: "À surveiller", emoji: "🟡", tone: "warn", hint: "On garde un œil dessus aux prochaines visites." },
  intervention_recommandee: { label: "Intervention recommandée", emoji: "🟠", tone: "warn", hint: "Un artisan devrait intervenir, avec l’accord du propriétaire." },
  urgent: { label: "Urgent", emoji: "🔴", tone: "danger", hint: "Partagé immédiatement au propriétaire." },
};

export const OBS_STATUS: Record<ObservationStatus, { label: string; tone: Tone }> = {
  nouveau: { label: "Nouveau", tone: "info" },
  en_attente_client: { label: "En attente de votre décision", tone: "warn" },
  autorise: { label: "Autorisé", tone: "ok" },
  artisan_contacte: { label: "Artisan contacté", tone: "info" },
  rdv_prevu: { label: "Rendez-vous prévu", tone: "info" },
  intervention_en_cours: { label: "Intervention en cours", tone: "warn" },
  resolu: { label: "Résolu", tone: "ok" },
  classe_sans_suite: { label: "Classé sans suite", tone: "neutral" },
};

export const OBS_STATUS_STAFF: Record<ObservationStatus, string> = {
  ...Object.fromEntries(Object.entries(OBS_STATUS).map(([k, v]) => [k, v.label])),
  en_attente_client: "En attente client",
} as Record<ObservationStatus, string>;

export const INTERVENTION_STATUS: Record<InterventionStatus, { label: string; tone: Tone }> = {
  a_planifier: { label: "À planifier", tone: "neutral" },
  artisan_contacte: { label: "Artisan contacté", tone: "info" },
  rdv_confirme: { label: "Rendez-vous confirmé", tone: "info" },
  en_cours: { label: "En cours", tone: "warn" },
  terminee: { label: "Terminée", tone: "ok" },
  annulee: { label: "Annulée", tone: "neutral" },
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  nouvelle: { label: "Nouvelle", tone: "danger" },
  vue: { label: "Vue", tone: "info" },
  planifiee: { label: "Planifiée", tone: "info" },
  en_cours: { label: "En cours", tone: "warn" },
  terminee: { label: "Terminée", tone: "ok" },
};

export const STAY_STATUS: Record<StayStatus, { label: string; tone: Tone }> = {
  declare: { label: "Séjour annoncé", tone: "info" },
  preparation_planifiee: { label: "Préparation planifiée", tone: "info" },
  pret: { label: "Maison prête", tone: "ok" },
  termine: { label: "Séjour terminé", tone: "neutral" },
  annule: { label: "Annulé", tone: "neutral" },
};

export const STAY_OPTIONS = [
  "Préparer la maison",
  "Ouvrir les volets",
  "Chauffer la maison",
  "Faire les lits",
  "Ménage avant arrivée",
  "Préparer du bois",
  "Faire quelques courses",
  "Remplir le réfrigérateur",
  "Vérifier le jardin",
  "Autre demande",
];

export const PHOTO_CATEGORIES = ["Extérieur", "Intérieur", "Cuisine", "Chaudière", "Anomalie", "Courrier", "Autre"];

export const TRADES = [
  "Plombier", "Électricien", "Chauffagiste", "Paysagiste", "Pisciniste", "Ménage",
  "Débarras", "Serrurier", "Couvreur", "Menuisier", "Maçon", "Autre",
];

export const CARNET_FIELDS: { key: string; label: string }[] = [
  { key: "heating_type", label: "Type de chauffage" },
  { key: "boiler", label: "Chaudière" },
  { key: "electric_meter", label: "Compteur électrique" },
  { key: "water_meter", label: "Compteur d’eau" },
  { key: "water_valve", label: "Vanne d’eau" },
  { key: "electrical_panel", label: "Tableau électrique" },
  { key: "internet", label: "Internet" },
  { key: "special_equipment", label: "Équipements particuliers" },
  { key: "outbuildings", label: "Dépendances" },
  { key: "pool", label: "Piscine" },
  { key: "gate", label: "Portail" },
  { key: "garden", label: "Jardin" },
  { key: "usual_tradespeople", label: "Artisans habituels" },
  { key: "insurer", label: "Assureur" },
  { key: "useful_contacts", label: "Contacts utiles" },
  { key: "particular_notes", label: "Notes particulières" },
];

export const TIMELINE_ICON: Record<string, string> = {
  visite: "✅",
  observation: "⚠️",
  intervention: "🔧",
  sejour: "🏠",
};
