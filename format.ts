const TZ = "Europe/Paris";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 8 octobre 2026 */
export function formatDate(value: string | Date | null | undefined, opts: { year?: boolean; weekday?: boolean } = { year: true }) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    ...(opts.year !== false ? { year: "numeric" } : {}),
    ...(opts.weekday ? { weekday: "long" } : {}),
  }).format(d);
}

/** 08/10/2026 */
export function formatDateShort(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** 10h42 */
export function formatTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    .format(d)
    .replace(":", "h");
}

/** 8 octobre 2026 · 10h42 */
export function formatDateTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  return `${formatDate(d)} · ${formatTime(d)}`;
}

/** Date au format YYYY-MM-DD (Paris) */
export function toDateInput(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Heure au format HH:MM (Paris) */
export function toTimeInput(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Convertit une date et une heure saisies (heure de Paris) en ISO UTC. */
export function parisToIso(date: string, time: string = "09:00") {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "09:00").split(":").map(Number);
  // Décalage Paris → UTC à la date considérée
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const parisParts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parisParts.find((p) => p.type === t)?.value);
  const asParis = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  const offset = asParis - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

export function todayParis() {
  return toDateInput(new Date());
}

export function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value));
}

export function formatRange(min: number | null, max: number | null) {
  if (min == null && max == null) return "";
  if (min != null && max != null) return `${formatMoney(min)} à ${formatMoney(max)}`;
  return formatMoney(min ?? max);
}

export function fullName(c: { first_name: string; last_name: string } | null | undefined) {
  if (!c) return "";
  return `${c.first_name} ${c.last_name}`.trim();
}

export function relativeDay(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  const today = todayParis();
  const day = toDateInput(d);
  if (day === today) return "Aujourd’hui";
  const t = new Date(today + "T12:00:00Z").getTime();
  const v = new Date(day + "T12:00:00Z").getTime();
  const diff = Math.round((v - t) / 86400000);
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return formatDate(d, { year: false, weekday: true });
}

export function minutesBetween(a: string | null, b: string | null) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 60000));
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
