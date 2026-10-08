/** Adresse d’un fichier privé servi par l’application (URL signée temporaire). */
export function fileUrl(bucket: "photos" | "documents" | "branding", path: string | null | undefined, download?: string | boolean) {
  if (!path) return "";
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const base = `/api/fichiers/${bucket}/${encoded}`;
  if (!download) return base;
  return `${base}?telecharger=${encodeURIComponent(download === true ? "1" : download)}`;
}

export function isRasterImage(path: string | null | undefined, mime?: string | null) {
  const p = (path ?? "").toLowerCase();
  const m = (mime ?? "").toLowerCase();
  return /\.(jpe?g|png)$/.test(p) || m === "image/jpeg" || m === "image/png";
}
