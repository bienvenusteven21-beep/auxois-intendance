import PDFDocument from "pdfkit";
import { formatDate, formatDateTime, formatRange, formatTime } from "@/lib/format";
import { HOUSE_STATUS, OBS_LEVEL, OBS_STATUS, VISIT_KIND } from "@/lib/labels";
import type { ObservationRow, PhotoRow, VisitItemRow, VisitRow, VisitSummary } from "@/lib/types";

const FOREST = "#1f3f31";
const BRONZE = "#a67f45";
const INK = "#22262a";
const MUTED = "#5c646c";
const LINE = "#e3dbc9";

export interface ReportInput {
  company: { name: string; tagline: string; phone?: string | null; email?: string | null; address?: string | null };
  property: { name: string; address?: string | null; postal_code?: string | null; commune?: string | null };
  visit: VisitRow;
  items: VisitItemRow[];
  observations: ObservationRow[];
  photos: (PhotoRow & { bytes?: Uint8Array | null })[];
  summary: VisitSummary | null;
}

/** Génère le rapport de visite PDF (A4). Retourne le contenu du fichier. */
export function buildVisitReport(input: ReportInput): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: `Rapport de visite — ${input.property.name}`, Author: input.company.name } });
    const chunks: Uint8Array[] = [];
    doc.on("data", (c: Uint8Array) => chunks.push(c));
    doc.on("end", () => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      resolve(out);
    });
    doc.on("error", reject);

    const W = doc.page.width - 96;
    const { visit, property, company } = input;
    const st = visit.general_status ? HOUSE_STATUS[visit.general_status] : null;

    // Bandeau
    doc.rect(0, 0, doc.page.width, 110).fill(FOREST);
    doc.fillColor("#f7f3ea").font("Times-Bold").fontSize(22).text(company.name.toUpperCase(), 48, 36, { characterSpacing: 2 });
    doc.font("Helvetica").fontSize(10).fillColor("#c9dbd0").text(company.tagline, 48, 66);
    doc.font("Helvetica").fontSize(10).fillColor("#c9dbd0").text("Rapport de visite", 48, 84);

    doc.moveDown();
    doc.y = 140;
    doc.fillColor(INK).font("Times-Bold").fontSize(26).text(property.name, 48);
    doc.font("Helvetica").fontSize(11).fillColor(MUTED).text([property.address, [property.postal_code, property.commune].filter(Boolean).join(" ")].filter(Boolean).join(", "));
    doc.moveDown(0.4);
    doc.fillColor(INK).fontSize(12).text(`${VISIT_KIND[visit.kind]} du ${formatDate(visit.ended_at ?? visit.scheduled_at)}`);
    const meta = [
      visit.started_at ? `Début ${formatTime(visit.started_at)}` : null,
      visit.ended_at ? `fin ${formatTime(visit.ended_at)}` : null,
      visit.intendant_name ? `Intendant : ${visit.intendant_name}` : null,
    ].filter(Boolean);
    doc.fillColor(MUTED).fontSize(10).text(meta.join(" · "));
    doc.moveDown(0.8);

    // État général
    if (st) {
      const color = st.tone === "ok" ? "#2f7a4f" : st.tone === "warn" ? "#c7731c" : "#b83a3a";
      const y = doc.y;
      doc.roundedRect(48, y, W, 54, 10).fill(st.tone === "ok" ? "#e1f1e7" : st.tone === "warn" ? "#fbeedc" : "#f9e3e3");
      doc.circle(72, y + 27, 9).fill(color);
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("ÉTAT GÉNÉRAL", 92, y + 12, { characterSpacing: 1 });
      doc.fillColor(INK).font("Times-Bold").fontSize(20).text(st.short, 92, y + 24);
      doc.y = y + 68;
    }

    // Résumé chiffré
    const s = input.summary;
    if (s) {
      const tiles = [
        [`${s.points_controles}`, "points contrôlés"],
        [`${s.ok}`, "OK"],
        [`${s.anomalies}`, s.anomalies > 1 ? "anomalies" : "anomalie"],
        [`${s.observations}`, s.observations > 1 ? "observations" : "observation"],
        [`${s.interventions_recommandees}`, "interv. recommandée(s)"],
        [`${s.photos}`, s.photos > 1 ? "photos" : "photo"],
      ];
      const tw = W / tiles.length;
      const y = doc.y;
      tiles.forEach(([v, l], i) => {
        const x = 48 + i * tw;
        doc.roundedRect(x + 3, y, tw - 6, 48, 8).lineWidth(0.8).stroke(LINE);
        doc.fillColor(FOREST).font("Times-Bold").fontSize(18).text(v, x + 3, y + 8, { width: tw - 6, align: "center" });
        doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(l, x + 3, y + 31, { width: tw - 6, align: "center" });
      });
      doc.y = y + 62;
    }

    const section = (title: string) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.moveDown(0.6);
      doc.fillColor(BRONZE).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), 48, doc.y, { characterSpacing: 1.5 });
      doc.moveTo(48, doc.y + 3).lineTo(48 + W, doc.y + 3).lineWidth(0.6).stroke(LINE);
      doc.moveDown(0.8);
      doc.fillColor(INK);
    };

    // Commentaire
    if (visit.intendant_comment) {
      section("Commentaire de l’intendant");
      doc.font("Times-Roman").fontSize(12).fillColor(INK).text(visit.intendant_comment, 48, doc.y, { width: W, lineGap: 2 });
    }
    const measures = [
      visit.indoor_temperature != null ? `Température intérieure : ${visit.indoor_temperature} °C` : null,
      visit.mail_count != null ? `Courrier relevé : ${visit.mail_count}` : null,
    ].filter(Boolean);
    if (measures.length) {
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(measures.join(" · "), 48);
    }

    // Observations
    if (input.observations.length) {
      section("Observations");
      for (const o of input.observations) {
        if (doc.y > doc.page.height - 120) doc.addPage();
        const lvl = OBS_LEVEL[o.level];
        const color = lvl.tone === "danger" ? "#b83a3a" : lvl.tone === "warn" ? "#c7731c" : "#3568a5";
        const y = doc.y;
        doc.circle(54, y + 6, 4).fill(color);
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(o.title, 66, y, { width: W - 18 });
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`${lvl.label} · ${OBS_STATUS[o.status].label} · ${formatDateTime(o.observed_at)}`, 66);
        if (o.description) doc.fillColor(INK).font("Helvetica").fontSize(10).text(o.description, 66, doc.y + 2, { width: W - 18 });
        if (o.recommended_action) doc.fillColor(INK).font("Helvetica-Oblique").fontSize(10).text(`Action recommandée : ${o.recommended_action}`, 66, doc.y + 2, { width: W - 18 });
        if (o.estimate_min != null || o.estimate_max != null) doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(`Coût estimatif : ${formatRange(o.estimate_min, o.estimate_max)}`, 66, doc.y + 2);
        doc.moveDown(0.7);
      }
    }

    // Interventions recommandées (récapitulatif)
    const reco = input.observations.filter((o) => o.level === "intervention_recommandee" || o.level === "urgent");
    if (reco.length) {
      section("Interventions recommandées");
      for (const o of reco) {
        doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(`• ${o.title}${o.recommended_action ? ` — ${o.recommended_action}` : ""}`, 48, doc.y, { width: W });
        doc.moveDown(0.3);
      }
    }

    // Checklist
    section("Checklist");
    const categories = [...new Set(input.items.map((i) => i.category))];
    for (const cat of categories) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(FOREST).text(cat, 48);
      doc.moveDown(0.2);
      for (const it of input.items.filter((i) => i.category === cat)) {
        if (doc.y > doc.page.height - 70) doc.addPage();
        const y = doc.y;
        const color = it.result === "ok" ? "#2f7a4f" : it.result === "anomalie" ? "#c7731c" : "#a6adb3";
        doc.circle(56, y + 5.5, 5).fill(color);
        if (it.result === "ok") {
          doc.moveTo(53.3, y + 5.6).lineTo(55.3, y + 7.6).lineTo(58.8, y + 3.6).lineWidth(1.2).stroke("#ffffff");
        } else {
          doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text(it.result === "anomalie" ? "!" : "-", 51.5, y + 2.2, { width: 9, align: "center" });
        }
        doc.fillColor(INK).font("Helvetica").fontSize(10).text(it.label, 68, y, { width: W - 120, continued: false });
        let right = "";
        if (it.kind === "number" && it.value_number != null) right = `${it.value_number}${it.unit ? ` ${it.unit}` : ""}`;
        else if (it.result === "non_controle" || !it.result) right = "non contrôlé";
        if (right) doc.fillColor(MUTED).fontSize(9).text(right, 48 + W - 100, y, { width: 100, align: "right" });
        if (it.note) doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9).text(it.note, 68, doc.y, { width: W - 40 });
        doc.moveDown(0.25);
      }
      doc.moveDown(0.3);
    }

    // Photos (JPEG / PNG uniquement)
    const printable = input.photos.filter((p) => p.bytes && p.bytes.length > 0);
    if (printable.length) {
      section("Photos");
      const cols = 2;
      const gap = 12;
      const pw = (W - gap) / cols;
      const ph = pw * 0.7;
      let col = 0;
      for (const p of printable) {
        if (col === 0 && doc.y + ph + 30 > doc.page.height - 48) doc.addPage();
        const x = 48 + col * (pw + gap);
        const y = doc.y;
        try {
          doc.image(Buffer.from(p.bytes!), x, y, { fit: [pw, ph], align: "center", valign: "center" });
        } catch {
          doc.rect(x, y, pw, ph).stroke(LINE);
        }
        doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`${p.caption || p.category || "Photo"} · ${formatDateTime(p.taken_at)}`, x, y + ph + 3, { width: pw });
        col += 1;
        if (col === cols) {
          col = 0;
          doc.y = y + ph + 20;
        } else {
          doc.y = y;
        }
      }
      if (col !== 0) doc.y += ph + 20;
    }
    const nonPrintable = input.photos.length - printable.length;
    if (nonPrintable > 0) {
      doc.moveDown(0.5);
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`${nonPrintable} photo${nonPrintable > 1 ? "s" : ""} consultable${nonPrintable > 1 ? "s" : ""} dans l’application.`, 48);
    }

    // Pied de page sur chaque page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footer = [company.name, company.phone, company.email, company.address].filter(Boolean).join(" · ");
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`${footer}   —   page ${i + 1}/${range.count}`, 48, doc.page.height - 36, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
