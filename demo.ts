export const DEMO_PROPERTY_IDS = {
  semur: "d0000000-0000-4000-8000-000000000011",
  epoisses: "d0000000-0000-4000-8000-000000000012",
  flavigny: "d0000000-0000-4000-8000-000000000013",
};

/** Fichiers de démonstration référencés par seed_demo() : bucket, propriété, nom. */
export const DEMO_FILES: { bucket: "photos" | "documents"; property: string; file: string; mime: string }[] = [
  { bucket: "photos", property: DEMO_PROPERTY_IDS.semur, file: "demo-facade.svg", mime: "image/svg+xml" },
  { bucket: "photos", property: DEMO_PROPERTY_IDS.epoisses, file: "demo-facade.svg", mime: "image/svg+xml" },
  { bucket: "photos", property: DEMO_PROPERTY_IDS.flavigny, file: "demo-facade.svg", mime: "image/svg+xml" },
  ...["jardin", "sejour", "cuisine", "chaudiere", "cave", "wc", "compteur", "robinet-avant", "robinet-apres"].map((n) => ({
    bucket: "photos" as const,
    property: DEMO_PROPERTY_IDS.semur,
    file: `demo-${n}.svg`,
    mime: "image/svg+xml",
  })),
  ...["contrat-serenite", "facture-plomberie", "notice-chaudiere", "inventaire-cles"].map((n) => ({
    bucket: "documents" as const,
    property: DEMO_PROPERTY_IDS.semur,
    file: `demo-${n}.pdf`,
    mime: "application/pdf",
  })),
];

export const DEMO_CLIENT_IDS = [1, 2, 3, 4].map((n) => `d0000000-0000-4000-8000-00000000000${n}`);

export const DEMO_CLIENT_EMAIL = "jean.martin@exemple.fr";
