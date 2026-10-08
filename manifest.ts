import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Auxois Intendance",
    short_name: "Auxois",
    description: "Votre maison, suivie toute l’année.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#1f3f31",
    lang: "fr",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
