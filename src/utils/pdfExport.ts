import jsPDF from "jspdf";
import type { Request, Patient, Staff } from "../types";
import { fmtDateTime, fmtShortDate, calcAge } from "./formatting";
import { reqTitle } from "./statusHelpers";
import { frequencyLabel } from "../data/frequencyOptions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

function statusLabel(s: string) {
  switch (s) {
    case "pending":  return "Pending Review";
    case "approved": return "Approved";
    case "denied":   return "Denied";
    case "rmi":      return "Needs Info";
    default:         return s;
  }
}

function typeLabel(t: string) {
  switch (t) {
    case "dme":             return "DME Request";
    case "medication":      return "Medication Request";
    case "multi_medication": return "Multi-Medication Batch";
    default:                return t;
  }
}

function urgencyLabel(u: string) {
  return u.charAt(0).toUpperCase() + u.slice(1);
}

// ─── Section helpers ──────────────────────────────────────────────────────────

function drawHRule(doc: jsPDF, y: number, alpha = 0.18) {
  doc.setDrawColor(44, 40, 37);
  doc.setGState(new (doc as any).GState({ opacity: alpha }));
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  return y;
}

function sectionHeading(doc: jsPDF, y: number, text: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(122, 116, 108); // textSub
  doc.text(text.toUpperCase(), MARGIN, y);
  drawHRule(doc, y + 2);
  return y + 8;
}

function labelValue(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  opts?: { colOffset?: number; bold?: boolean }
): number {
  const x = MARGIN + (opts?.colOffset ?? 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(122, 116, 108);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(9);
  doc.setTextColor(44, 40, 37);
  doc.text(value, x, y + 4.5);
  return y + 4.5;
}

function wrappedParagraph(doc: jsPDF, y: number, label: string, text: string, maxW = CONTENT_W): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(122, 116, 108);
  doc.text(label.toUpperCase(), MARGIN, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(44, 40, 37);
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 4.8;
}

// ─── Main export function ─────────────────────────────────────────────────────

export function exportRequestPdf(
  request: Request,
  patient: Patient | undefined,
  submitter: Staff | undefined,
  processor: Staff | undefined,
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = MARGIN;

  // ── Header bar ──────────────────────────────────────────────────────────────
  // Green accent strip
  doc.setFillColor(91, 122, 94); // accent
  doc.rect(0, 0, PAGE_W, 14, "F");

  // Org name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("Parrish Health", MARGIN, 9);

  // "DME Portal" label right-aligned
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("DME Portal", PAGE_W - MARGIN, 9, { align: "right" });

  y = 22;

  // ── Request title block ──────────────────────────────────────────────────────
  // Type + status on one line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(74, 122, 155); // info
  doc.text(typeLabel(request.details.type), MARGIN, y);

  const statusText = statusLabel(request.status).toUpperCase();
  const statusColors: Record<string, [number, number, number]> = {
    pending:  [201, 151, 45],
    approved: [91, 122, 94],
    denied:   [196, 83, 58],
    rmi:      [123, 97, 168],
  };
  const [sr, sg, sb] = statusColors[request.status] ?? [122, 116, 108];
  doc.setTextColor(sr, sg, sb);
  doc.text(statusText, PAGE_W - MARGIN, y, { align: "right" });

  y += 6;

  // Big title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(44, 40, 37);
  doc.text(reqTitle(request), MARGIN, y);

  // Request ID badge (small, right-aligned)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(122, 116, 108);
  doc.text(request.id.toUpperCase(), PAGE_W - MARGIN, y, { align: "right" });

  y += 10;
  drawHRule(doc, y);
  y += 6;

  // ── Patient & submission meta ─────────────────────────────────────────────
  y = sectionHeading(doc, y, "Patient & Submission");

  const col2 = CONTENT_W / 2 + 4;

  // Row 1: Patient | Submitted by
  labelValue(doc, y, "Patient",
    patient ? `${patient.name}  ·  MRN ${patient.mrn}` : "Unknown");
  labelValue(doc, y, "Submitted By",
    submitter ? `${submitter.displayName} (${submitter.role.replace("_", " ")})` : "Unknown",
    { colOffset: col2 });
  y += 11;

  // Row 2: DOB / Age | Submitted at
  if (patient) {
    labelValue(doc, y, "Date of Birth",
      `${fmtShortDate(patient.dob)}  ·  Age ${calcAge(patient.dob)}`);
  }
  labelValue(doc, y, "Submitted", fmtDateTime(request.createdAt), { colOffset: col2 });
  y += 11;

  // Row 3: Insurance | (allergies if any)
  if (patient) {
    labelValue(doc, y, "Insurance", patient.insurance);
    if (patient.allergies.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(196, 83, 58);
      doc.text("ALLERGIES", MARGIN + col2, y);
      doc.setFontSize(8.5);
      doc.text(patient.allergies.join(", "), MARGIN + col2, y + 4.5);
      doc.setTextColor(44, 40, 37);
    }
    y += 11;
  }

  y += 3;

  // ── Type-specific details ─────────────────────────────────────────────────
  const { details } = request;

  if (details.type === "dme") {
    y = sectionHeading(doc, y, "DME Request Details");

    labelValue(doc, y, "Equipment", details.equipmentName);
    labelValue(doc, y, "Urgency", urgencyLabel(details.urgency), { colOffset: col2, bold: details.urgency !== "routine" });
    y += 11;

    labelValue(doc, y, "ICD-10 Code", details.icd10Code);
    labelValue(doc, y, "Diagnosis", details.icd10Description, { colOffset: col2 });
    y += 14;

    y = wrappedParagraph(doc, y, "Clinical Justification", details.justification);
  }

  if (details.type === "medication") {
    y = sectionHeading(doc, y, "Medication Request Details");

    labelValue(doc, y, "Medication", `${details.drugName}  ·  RxCUI ${details.rxcui}`);
    labelValue(doc, y, "Pharmacy", details.pharmacy, { colOffset: col2 });
    y += 11;

    if (details.strength || details.doseForm || details.route) {
      const parts = [
        details.strength ? `Strength: ${details.strength}` : "",
        details.doseForm ? `Form: ${details.doseForm}` : "",
        details.route ? `Route: ${details.route}` : "",
      ].filter(Boolean);
      labelValue(doc, y, "Drug Details", parts.join("  ·  "));
      y += 11;
    }

    labelValue(doc, y, "Quantity", `${details.quantity} units`);
    labelValue(doc, y, "Refills", details.refills.toString(), { colOffset: col2 });
    y += 11;

    if (details.frequency) {
      labelValue(doc, y, "Frequency", frequencyLabel(details.frequency));
      if (details.startDate) {
        labelValue(doc, y, "Start Date", details.startDate, { colOffset: col2 });
      }
      y += 11;
    } else if (details.startDate) {
      labelValue(doc, y, "Start Date", details.startDate);
      y += 11;
    }

    if (details.indication) {
      labelValue(doc, y, "Indication", `${details.indication.code}  ·  ${details.indication.description}`);
      y += 11;
    }

    if (details.justification) {
      y += 2;
      y = wrappedParagraph(doc, y, "Notes", details.justification);
    }
  }

  if (details.type === "multi_medication") {
    y = sectionHeading(doc, y, "Multi-Medication Batch Details");

    labelValue(doc, y, "Pharmacy", details.pharmacy);
    if (details.startDate) {
      labelValue(doc, y, "Start Date", details.startDate, { colOffset: col2 });
    }
    y += 11;

    if (details.indication) {
      labelValue(doc, y, "Indication", `${details.indication.code}  ·  ${details.indication.description}`);
      y += 11;
    }

    // Drug table header — 6 columns
    doc.setFillColor(239, 235, 228); // bgSub
    doc.rect(MARGIN, y - 2, CONTENT_W, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(122, 116, 108);
    const col = [0, CONTENT_W * 0.35, CONTENT_W * 0.50, CONTENT_W * 0.62, CONTENT_W * 0.76, CONTENT_W * 0.88];
    doc.text("MEDICATION", MARGIN + col[0] + 2, y + 2.5);
    doc.text("FREQ", MARGIN + col[1], y + 2.5);
    doc.text("STRENGTH", MARGIN + col[2], y + 2.5);
    doc.text("FORM", MARGIN + col[3], y + 2.5);
    doc.text("QTY", MARGIN + col[4], y + 2.5);
    doc.text("REFILLS", MARGIN + col[5], y + 2.5);
    y += 7;

    details.drugs.forEach((d, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(247, 244, 239); // bg
        doc.rect(MARGIN, y - 2, CONTENT_W, 7, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(44, 40, 37);
      doc.text(d.drugName, MARGIN + col[0] + 2, y + 2.5);
      doc.text(d.frequency ? frequencyLabel(d.frequency).split(" — ")[0] : "—", MARGIN + col[1], y + 2.5);
      doc.text(d.strength || "—", MARGIN + col[2], y + 2.5);
      doc.text(d.doseForm || "—", MARGIN + col[3], y + 2.5);
      doc.text(d.quantity.toString(), MARGIN + col[4], y + 2.5);
      doc.text(d.refills.toString(), MARGIN + col[5], y + 2.5);
      y += 7;
    });

    // Border around the table
    doc.setDrawColor(226, 221, 213);
    doc.setLineWidth(0.3);
    const tableH = 7 + details.drugs.length * 7;
    doc.rect(MARGIN, y - tableH - 2, CONTENT_W, tableH + 2);

    y += 4;

    if (details.justification) {
      y = wrappedParagraph(doc, y, "Notes", details.justification);
    }
  }

  y += 6;

  // ── Admin review (if processed) ───────────────────────────────────────────
  if (request.adminNotes || request.processedAt) {
    y = sectionHeading(doc, y, "Admin Review");

    if (request.adminNotes) {
      y = wrappedParagraph(doc, y, "Notes", request.adminNotes);
      y += 4;
    }
    if (request.processedAt) {
      labelValue(doc, y, "Processed By", processor ? processor.displayName : "Unknown");
      labelValue(doc, y, "Processed At", fmtDateTime(request.processedAt), { colOffset: col2 });
      y += 11;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(239, 235, 228);
  doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(122, 116, 108);
  doc.text("Parrish Health DME Portal  ·  Confidential", MARGIN, PAGE_H - 4);
  doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, PAGE_W - MARGIN, PAGE_H - 4, { align: "right" });

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `${request.id.toUpperCase()}_${(patient?.name ?? "unknown").replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
