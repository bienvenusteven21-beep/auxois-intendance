/* Génère les fichiers de démonstration (public/demo) : npx tsx scripts/make-demo-files.ts */
import { mkdirSync, writeFileSync } from "node:fs";
import PDFDocument from "pdfkit";

const OUT = "public/demo";
mkdirSync(OUT, { recursive: true });

const FOREST = "#1f3f31";
const CREAM = "#f7f3ea";
const BRONZE = "#bf9a5e";
const SKY = "#dfe8e3";

function svg(name: string, title: string, scene: string, bg = SKY) {
  const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="${bg}"/>
  ${scene}
  <rect x="0" y="540" width="800" height="60" fill="${FOREST}"/>
  <text x="24" y="578" font-family="Georgia, serif" font-size="26" fill="${CREAM}">${title}</text>
  <text x="776" y="578" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="${BRONZE}">Photo de démonstration · Auxois Intendance</text>
</svg>`;
  writeFileSync(`${OUT}/${name}`, content);
}

const house = `
  <rect x="0" y="380" width="800" height="160" fill="#b7c7b0"/>
  <path d="M120 380 L120 220 L380 100 L640 220 L640 380 Z" fill="#efe9dc" stroke="#cfc4ad" stroke-width="3"/>
  <path d="M100 230 L380 90 L660 230 L640 250 L380 125 L120 250 Z" fill="#8a6a37"/>
  <rect x="340" y="280" width="80" height="100" fill="${FOREST}"/>
  <rect x="170" y="260" width="70" height="70" fill="#9dbcab" stroke="${FOREST}" stroke-width="4"/>
  <rect x="520" y="260" width="70" height="70" fill="#9dbcab" stroke="${FOREST}" stroke-width="4"/>
  <rect x="40" y="330" width="60" height="50" fill="#cfc4ad"/><rect x="40" y="330" width="60" height="50" fill="none" stroke="#8a6a37" stroke-width="3"/>
  <circle cx="700" cy="140" r="40" fill="#f3eadb"/>
`;
svg("demo-facade.svg", "Façade et portail", house);

svg(
  "demo-jardin.svg",
  "Jardin côté remise",
  `<rect x="0" y="300" width="800" height="240" fill="#a9c4a0"/>
   <ellipse cx="200" cy="300" rx="110" ry="140" fill="#44795f"/><rect x="190" y="380" width="20" height="90" fill="#8a6a37"/>
   <ellipse cx="560" cy="280" rx="130" ry="160" fill="#35674f"/><rect x="548" y="380" width="24" height="100" fill="#8a6a37"/>
   <circle cx="230" cy="260" r="10" fill="#c7731c"/><circle cx="180" cy="300" r="10" fill="#c7731c"/>
   <rect x="640" y="330" width="130" height="90" fill="#cfc4ad"/><path d="M630 330 L705 290 L780 330 Z" fill="#8a6a37"/>
   <path d="M60 480 Q400 440 740 480" stroke="#efe9dc" stroke-width="10" fill="none"/>`,
);

svg(
  "demo-sejour.svg",
  "Séjour",
  `<rect x="0" y="380" width="800" height="160" fill="#cfc4ad"/>
   <rect x="0" y="0" width="800" height="380" fill="#f3eadb"/>
   <rect x="80" y="120" width="180" height="200" fill="#dfe8e3" stroke="#8a6a37" stroke-width="6"/>
   <rect x="330" y="300" width="340" height="110" rx="20" fill="${FOREST}"/>
   <rect x="340" y="250" width="320" height="70" rx="16" fill="#2a5340"/>
   <rect x="560" y="120" width="120" height="180" fill="#8a6a37"/><rect x="600" y="140" width="40" height="60" fill="#c7731c"/>
   <ellipse cx="300" cy="470" rx="150" ry="30" fill="#bf9a5e" opacity="0.6"/>`,
  "#f3eadb",
);

svg(
  "demo-cuisine.svg",
  "Cuisine",
  `<rect x="0" y="0" width="800" height="540" fill="#f7f3ea"/>
   <rect x="60" y="300" width="680" height="200" fill="#efe9dc" stroke="#cfc4ad" stroke-width="3"/>
   <rect x="60" y="290" width="680" height="20" fill="#2b2b2b"/>
   <rect x="100" y="330" width="120" height="150" fill="#dfe8e3" stroke="#cfc4ad"/><rect x="250" y="330" width="120" height="150" fill="#dfe8e3" stroke="#cfc4ad"/>
   <rect x="420" y="330" width="120" height="150" fill="#dfe8e3" stroke="#cfc4ad"/><rect x="570" y="330" width="130" height="150" fill="#dfe8e3" stroke="#cfc4ad"/>
   <rect x="60" y="80" width="300" height="150" fill="#efe9dc" stroke="#cfc4ad" stroke-width="3"/>
   <rect x="420" y="80" width="320" height="150" fill="#efe9dc" stroke="#cfc4ad" stroke-width="3"/>
   <rect x="300" y="250" width="200" height="40" fill="#9dbcab"/>`,
  "#f7f3ea",
);

svg(
  "demo-chaudiere.svg",
  "Chaudière — pression 1,5 bar",
  `<rect x="0" y="0" width="800" height="540" fill="#efe9dc"/>
   <rect x="250" y="80" width="300" height="400" rx="18" fill="#f7f3ea" stroke="#cfc4ad" stroke-width="4"/>
   <circle cx="400" cy="200" r="70" fill="#ffffff" stroke="#22262a" stroke-width="4"/>
   <path d="M400 200 L430 150" stroke="#b83a3a" stroke-width="5"/><circle cx="400" cy="200" r="6" fill="#22262a"/>
   <text x="400" y="300" text-anchor="middle" font-family="Helvetica, Arial" font-size="28" fill="#22262a">1,5 bar</text>
   <rect x="300" y="340" width="200" height="90" rx="8" fill="#dfe8e3"/>
   <circle cx="340" cy="385" r="12" fill="#2f7a4f"/><circle cx="400" cy="385" r="12" fill="#cfc4ad"/><circle cx="460" cy="385" r="12" fill="#cfc4ad"/>
   <rect x="380" y="480" width="40" height="60" fill="#8a6a37"/>`,
  "#efe9dc",
);

svg(
  "demo-cave.svg",
  "Cave — hygrométrie en baisse",
  `<rect x="0" y="0" width="800" height="540" fill="#3b4147"/>
   <path d="M0 200 Q400 40 800 200 L800 540 L0 540 Z" fill="#5c646c"/>
   <rect x="0" y="420" width="800" height="120" fill="#2b2b2b"/>
   <rect x="80" y="260" width="240" height="160" fill="#8a6a37"/><rect x="100" y="280" width="200" height="30" fill="#a67f45"/><rect x="100" y="330" width="200" height="30" fill="#a67f45"/>
   <rect x="560" y="120" width="120" height="60" fill="#9dbcab" opacity="0.7"/>
   <rect x="440" y="300" width="80" height="120" rx="8" fill="#f7f3ea"/><text x="480" y="370" text-anchor="middle" font-family="Helvetica" font-size="22" fill="#22262a">62 %</text>`,
  "#3b4147",
);

svg(
  "demo-wc.svg",
  "Chasse d’eau des WC de l’étage",
  `<rect x="0" y="0" width="800" height="540" fill="#f7f3ea"/>
   <rect x="0" y="380" width="800" height="160" fill="#dfe8e3"/>
   <rect x="300" y="120" width="200" height="140" rx="16" fill="#ffffff" stroke="#cfc4ad" stroke-width="4"/>
   <ellipse cx="400" cy="340" rx="130" ry="70" fill="#ffffff" stroke="#cfc4ad" stroke-width="4"/>
   <rect x="330" y="250" width="140" height="90" fill="#ffffff" stroke="#cfc4ad" stroke-width="4"/>
   <path d="M470 330 q10 30 0 50 q-10 -20 0 -50" fill="#3568a5"/>
   <circle cx="560" cy="300" r="36" fill="none" stroke="#c7731c" stroke-width="6"/><text x="560" y="310" text-anchor="middle" font-family="Helvetica" font-size="30" fill="#c7731c">!</text>`,
  "#f7f3ea",
);

svg(
  "demo-compteur.svg",
  "Relevé du compteur d’eau (interne)",
  `<rect x="0" y="0" width="800" height="540" fill="#cfc4ad"/>
   <circle cx="400" cy="270" r="170" fill="#22262a"/><circle cx="400" cy="270" r="140" fill="#f7f3ea"/>
   <rect x="300" y="245" width="200" height="50" fill="#22262a"/>
   <text x="400" y="282" text-anchor="middle" font-family="Courier, monospace" font-size="34" fill="#f7f3ea">0 1 2 8 4 7</text>
   <text x="400" y="340" text-anchor="middle" font-family="Helvetica" font-size="18" fill="#5c646c">m³</text>`,
  "#cfc4ad",
);

const faucet = (leak: boolean) => `
   <rect x="0" y="0" width="800" height="540" fill="#efe9dc"/>
   <rect x="0" y="0" width="800" height="300" fill="#cfc4ad"/>
   <rect x="0" y="300" width="800" height="240" fill="#a9c4a0"/>
   <rect x="360" y="100" width="40" height="120" fill="#8a6a37"/>
   <path d="M380 110 Q470 110 470 200" stroke="#8a6a37" stroke-width="30" fill="none" stroke-linecap="round"/>
   <circle cx="380" cy="90" r="30" fill="${leak ? "#b83a3a" : "#2f7a4f"}"/>
   ${leak ? '<ellipse cx="470" cy="240" rx="8" ry="14" fill="#3568a5"/><ellipse cx="470" cy="290" rx="8" ry="14" fill="#3568a5"/><ellipse cx="480" cy="330" rx="40" ry="10" fill="#3568a5" opacity="0.5"/>' : '<circle cx="470" cy="230" r="0" />'}
`;
svg("demo-robinet-avant.svg", "Robinet extérieur avant intervention", faucet(true), "#efe9dc");
svg("demo-robinet-apres.svg", "Robinet remplacé", faucet(false), "#efe9dc");

// ---- PDF de démonstration ---------------------------------------------------
function pdf(name: string, title: string, lines: string[]) {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const chunks: Uint8Array[] = [];
  doc.on("data", (c: Uint8Array) => chunks.push(c));
  doc.on("end", () => writeFileSync(`${OUT}/${name}`, Buffer.concat(chunks.map((c) => Buffer.from(c)))));
  doc.rect(0, 0, doc.page.width, 90).fill(FOREST);
  doc.fillColor(CREAM).font("Times-Bold").fontSize(20).text("AUXOIS INTENDANCE", 56, 34, { characterSpacing: 2 });
  doc.font("Helvetica").fontSize(9).fillColor("#c9dbd0").text("Document de démonstration — sans valeur contractuelle", 56, 62);
  doc.y = 130;
  doc.fillColor("#22262a").font("Times-Bold").fontSize(24).text(title, 56);
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(11).fillColor("#3b4147");
  for (const l of lines) {
    if (l === "") doc.moveDown(0.6);
    else doc.text(l, { lineGap: 3 });
  }
  doc.moveDown(2);
  doc.fillColor("#7c848c").fontSize(9).text("Ce document a été généré automatiquement pour la démonstration de l’application Auxois Intendance.", { align: "center" });
  doc.end();
}

pdf("demo-contrat-serenite.pdf", "Contrat d’intendance — formule Sérénité", [
  "Entre : Auxois Intendance, Semur-en-Auxois (21140),",
  "et : M. Jean Martin, propriétaire de la « Maison de Semur », 5 rue du Rempart, 21140 Semur-en-Auxois.",
  "",
  "Objet : intendance de résidence secondaire selon la formule Sérénité (129 € par mois).",
  "",
  "Prestations incluses :",
  "• 12 visites de contrôle par an, avec débrief et photos après chaque visite ;",
  "• carnet de santé numérique de la maison ;",
  "• relevé du courrier ;",
  "• organisation et suivi des interventions d’artisans, avec l’accord du propriétaire ;",
  "• préparation de la maison avant chaque arrivée.",
  "",
  "Durée : un an, renouvelable tacitement. Résiliation possible à tout moment avec un préavis d’un mois.",
  "",
  "Clés : un trousseau est confié à Auxois Intendance et conservé dans une armoire sécurisée. Chaque consultation des informations d’accès est journalisée.",
]);

pdf("demo-facture-plomberie.pdf", "Facture n° 2026-0917 — Dupont Plomberie", [
  "Dupont Plomberie — 21140 Semur-en-Auxois",
  "Client : Auxois Intendance pour le compte de M. Jean Martin",
  "Chantier : Maison de Semur, 5 rue du Rempart",
  "",
  "Désignation :",
  "• Remplacement du robinet de puisage extérieur : 58,00 €",
  "• Fourniture robinet laiton 1/2'' avec purge : 19,00 €",
  "• Déplacement : 15,40 €",
  "",
  "Total TTC : 92,40 €",
  "",
  "Payable à réception. Merci de votre confiance.",
]);

pdf("demo-notice-chaudiere.pdf", "Notice simplifiée — chaudière gaz à condensation", [
  "Modèle installé en 2019, buanderie de la Maison de Semur.",
  "",
  "Pression de service : entre 1 et 2 bar (idéalement 1,5 bar à froid).",
  "Si la pression descend sous 1 bar : ouvrir doucement le robinet de remplissage (sous la chaudière) jusqu’à 1,5 bar, puis le refermer.",
  "",
  "Mode hors gel : maintenir la chaudière sous tension en hiver. La consigne hors gel est réglée à 12 °C.",
  "",
  "Entretien annuel : contrat avec Auxois Chauffage Service. Dernier entretien : mai 2026.",
  "",
  "En cas de code erreur affiché : noter le code, couper puis rallumer l’appareil. Si l’erreur persiste, prévenir Auxois Intendance.",
]);

pdf("demo-inventaire-cles.pdf", "Inventaire des clés — document interne", [
  "Maison de Semur — trousseau n° 12 (armoire à clés, crochet 12)",
  "",
  "• Clé porte d’entrée (reproduction protégée) × 2",
  "• Clé porte de service × 1",
  "• Clé remise à bois × 1",
  "• Cadenas du portail : combinaison conservée dans l’espace sécurisé de l’application.",
  "",
  "Remis par le propriétaire le 2 novembre 2025, en présence de M. Jean Martin.",
  "",
  "Ce document est réservé à l’équipe Auxois Intendance.",
]);

console.log("Fichiers de démonstration générés dans", OUT);
