/* Vérification locale du générateur de rapport PDF : npx tsx scripts/test-pdf.ts */
import { writeFileSync } from "node:fs";
import { buildVisitReport } from "../lib/pdf/visit-report";

const now = new Date("2026-10-08T08:42:00Z").toISOString();
buildVisitReport({
  company: { name: "Auxois Intendance", tagline: "Votre maison, suivie toute l’année.", phone: "03 80 00 00 00", email: "contact@exemple.fr", address: "Semur-en-Auxois" },
  property: { name: "Maison de Semur", address: "5 rue du Rempart", postal_code: "21140", commune: "Semur-en-Auxois" },
  visit: {
    id: "v", property_id: "p", kind: "reguliere", stay_id: null, scheduled_at: now, started_at: "2026-10-08T08:04:00Z", ended_at: now,
    intendant_id: null, intendant_name: "Camille Durand", status: "terminee", general_status: "bon",
    intendant_comment: "Maison globalement en très bon état.\nPetite fuite constatée sur la chasse d’eau des WC de l’étage.\nJe recommande de faire intervenir le plombier.",
    indoor_temperature: 17.5, mail_count: 3, debrief_sent_at: now, created_at: now,
  },
  items: [
    { id: "1", visit_id: "v", category: "Accès", label: "Portail", kind: "check", unit: null, position: 10, result: "ok", value_number: null, note: null, checked_at: now },
    { id: "2", visit_id: "v", category: "Eau", label: "Sanitaires", kind: "check", unit: null, position: 20, result: "anomalie", value_number: null, note: "Chasse d’eau des WC de l’étage : léger écoulement continu.", checked_at: now },
    { id: "3", visit_id: "v", category: "Chauffage", label: "Température intérieure", kind: "number", unit: "°C", position: 30, result: "ok", value_number: 17.5, note: null, checked_at: now },
    { id: "4", visit_id: "v", category: "Extérieurs", label: "Toiture : contrôle visuel uniquement", kind: "check", unit: null, position: 40, result: null, value_number: null, note: null, checked_at: null },
  ],
  observations: [
    { id: "o", property_id: "p", visit_id: "v", checklist_item_id: null, title: "Chasse d’eau WC étage — fuite légère", description: "Filet d’eau continu.", level: "intervention_recommandee", recommended_action: "Intervention plombier recommandée.", estimate_min: 80, estimate_max: 150, status: "en_attente_client", client_decision: null, client_decision_at: null, is_shared: true, observed_at: now, resolved_at: null, created_by: null, created_at: now },
  ],
  photos: [],
  summary: { points_controles: 3, points_total: 4, ok: 2, anomalies: 1, non_controles: 1, observations: 1, interventions_recommandees: 1, photos: 0 },
}).then((bytes) => {
  writeFileSync("/tmp/test-rapport.pdf", bytes);
  console.log("PDF généré :", bytes.length, "octets");
});
