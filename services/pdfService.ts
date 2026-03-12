/**
 * pdfService.ts — Phase 3: Document generation
 *
 * Generates formatted PDF exports for approved DME requests and
 * medication orders using jsPDF. Each document includes:
 *   - Parrish Health header
 *   - Patient demographics
 *   - Request details
 *   - Unique document ID and generation timestamp
 *   - Approval metadata (admin, date)
 *   - QR code linking back to the portal record (Phase 3 §3.2)
 *
 * Also exports a CMS-1500-style insurance claim pre-fill for DME requests.
 *
 * No PHI leaves the browser — all generation is client-side.
 */

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Request, DMERequestDetails, MedicationRequestDetails, MultiMedicationRequestDetails } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const HEADER_COLOR:  [number, number, number] = [15, 31, 56];   // slate-900
const ACCENT_COLOR:  [number, number, number] = [37, 99, 235];  // blue-600
const MUTED_COLOR:   [number, number, number] = [100, 116, 139]; // slate-500
const GREEN_COLOR:   [number, number, number] = [22, 163, 74];  // green-600

function drawHeader(doc: jsPDF, docId: string): number {
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, pageW, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PARRISH HEALTH', 12, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('DME & Medication Portal', 12, 16);
  doc.text(`Doc ID: ${docId}`, pageW - 12, 10, { align: 'right' });
  doc.text(`Generated: ${formatDate(Date.now())}`, pageW - 12, 16, { align: 'right' });

  return 30; // next y
}

function drawSectionHeader(doc: jsPDF, y: number, title: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(12, y, pageW - 24, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 15, y + 4.2);
  return y + 10;
}

function drawRow(doc: jsPDF, y: number, label: string, value: string, indent = 12): number {
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(7.5);
  doc.text(label, indent, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  const pageW = doc.internal.pageSize.getWidth();
  const lines = doc.splitTextToSize(value || '—', pageW - indent - 60);
  doc.text(lines, indent + 55, y);
  return y + Math.max(7, lines.length * 5);
}

function drawApprovalStamp(doc: jsPDF, y: number, request: Request): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...GREEN_COLOR);
  doc.setLineWidth(0.5);
  doc.roundedRect(12, y, pageW - 24, 18, 2, 2, 'S');
  doc.setFillColor(240, 253, 244); // green-50
  doc.roundedRect(12, y, pageW - 24, 18, 2, 2, 'F');
  doc.setTextColor(...GREEN_COLOR);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('✓  APPROVED', 18, y + 7);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED_COLOR);
  if (request.processedAt) doc.text(`Date: ${formatDate(request.processedAt)}`, 18, y + 13);
  if (request.adminNotes) {
    const note = doc.splitTextToSize(`Notes: ${request.adminNotes}`, pageW - 90);
    doc.text(note, pageW / 2, y + 7, { align: 'left' });
  }
  return y + 24;
}

function drawFooter(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(12, pageH - 14, pageW - 12, pageH - 14);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'CONFIDENTIAL — For internal clinical use only. This document contains Protected Health Information (PHI) covered by HIPAA.',
    pageW / 2, pageH - 9, { align: 'center' }
  );
}

/**
 * Render a QR code in the bottom-right corner of the current page.
 * The QR content is the portal URL for the given request ID so staff
 * can scan and navigate directly to the record.
 */
async function drawQRCode(doc: jsPDF, requestId: string): Promise<void> {
  const portalUrl = `${window.location.origin}/#/requests/${requestId}`;
  const dataUrl = await QRCode.toDataURL(portalUrl, {
    width: 64,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const size  = 22; // mm

  doc.addImage(dataUrl, 'PNG', pageW - size - 12, pageH - size - 18, size, size);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Scan to view record', pageW - size / 2 - 12, pageH - 15, { align: 'center' });
}

// ─── DME Request PDF ──────────────────────────────────────────────────────────

export async function generateDMERequestPDF(request: Request): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const docId = `DME-${request.id.slice(0, 8).toUpperCase()}`;
  let y = drawHeader(doc, docId);

  // Title
  doc.setTextColor(...ACCENT_COLOR);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DME Request — Authorization Document', 12, y);
  y += 10;

  // Patient
  y = drawSectionHeader(doc, y, 'Patient Information');
  y = drawRow(doc, y, 'Patient Name', request.patientName);
  y = drawRow(doc, y, 'Patient / MRN', request.patientId);
  y = drawRow(doc, y, 'Submitted By', request.submitterName);
  y = drawRow(doc, y, 'Submission Date', formatDate(request.createdAt));
  y += 3;

  // Equipment
  const dme = request.details as DMERequestDetails;
  y = drawSectionHeader(doc, y, 'Equipment Details');
  y = drawRow(doc, y, 'Category', dme.equipment?.category ?? '');
  y = drawRow(doc, y, 'Item', dme.equipment?.item ?? '');
  y = drawRow(doc, y, 'Request Type', dme.equipment?.reqType ?? '');
  y = drawRow(doc, y, 'Delivery Method', dme.equipment?.delivery ?? '');
  if (dme.equipment?.specialFeatures) {
    y = drawRow(doc, y, 'Special Features', dme.equipment.specialFeatures);
  }
  y += 3;

  // Clinical
  y = drawSectionHeader(doc, y, 'Clinical Information');
  y = drawRow(doc, y, 'Primary ICD-10', dme.clinical?.icd10 ?? '');
  if (dme.clinical?.secondaryIcd10) {
    y = drawRow(doc, y, 'Secondary ICD-10', dme.clinical.secondaryIcd10);
  }
  y = drawRow(doc, y, 'Clinical Justification', dme.clinical?.justification ?? '');
  y = drawRow(doc, y, 'Prescription Date', dme.clinical?.prescriptionDate ? formatShortDate(dme.clinical.prescriptionDate) : '');
  y = drawRow(doc, y, 'Length of Need', dme.clinical?.lengthOfNeed ?? '');
  y = drawRow(doc, y, 'Prior Authorization', dme.clinical?.priorAuth ?? '');
  y = drawRow(doc, y, 'Urgency', dme.clinical?.urgency ?? '');
  y += 5;

  // Approval stamp
  if (request.status === 'approved') {
    y = drawApprovalStamp(doc, y, request);
  }

  drawFooter(doc);
  await drawQRCode(doc, request.id);
  doc.save(`${docId}-${request.patientName.replace(/\s+/g, '-')}.pdf`);
}

// ─── Medication Order PDF ─────────────────────────────────────────────────────

export async function generateMedicationOrderPDF(request: Request): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const docId = `MED-${request.id.slice(0, 8).toUpperCase()}`;
  let y = drawHeader(doc, docId);

  // Title
  doc.setTextColor(...ACCENT_COLOR);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Medication Order — Authorization Document', 12, y);
  y += 10;

  // Patient
  y = drawSectionHeader(doc, y, 'Patient Information');
  y = drawRow(doc, y, 'Patient Name', request.patientName);
  y = drawRow(doc, y, 'Patient / MRN', request.patientId);
  y = drawRow(doc, y, 'Submitted By', request.submitterName);
  y = drawRow(doc, y, 'Submission Date', formatDate(request.createdAt));
  y += 3;

  // Medication(s)
  y = drawSectionHeader(doc, y, 'Medication Details');

  if (request.type === 'medication') {
    const med = request.details as MedicationRequestDetails;
    y = drawRow(doc, y, 'Drug Name', med.medication?.name ?? '');
    y = drawRow(doc, y, 'Strength', med.medication?.strength ?? '');
    if (med.medication?.form) y = drawRow(doc, y, 'Form', med.medication.form);
    if (med.medication?.rxcui) y = drawRow(doc, y, 'RxNorm CUI', med.medication.rxcui);
    if (med.medication?.sig) y = drawRow(doc, y, 'Sig', med.medication.sig);
    if (med.medication?.quantity !== undefined) y = drawRow(doc, y, 'Quantity', String(med.medication.quantity));
    if (med.medication?.refills !== undefined) y = drawRow(doc, y, 'Refills', String(med.medication.refills));
    y += 3;
    y = drawSectionHeader(doc, y, 'Clinical Information');
    if (med.clinical?.icd10) y = drawRow(doc, y, 'ICD-10', med.clinical.icd10);
    if (med.clinical?.diagnosis) y = drawRow(doc, y, 'Diagnosis / Indication', med.clinical.diagnosis);
    if (med.clinical?.allergies) y = drawRow(doc, y, 'Known Allergies', med.clinical.allergies);
    if (med.clinical?.pharmacyNotes) y = drawRow(doc, y, 'Pharmacy Notes', med.clinical.pharmacyNotes);

  } else if (request.type === 'medication') {
    // handled above
  } else {
    // Multi-medication
    const multi = request.details as MultiMedicationRequestDetails;
    (multi.medications ?? []).forEach((m, i) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ACCENT_COLOR);
      doc.setFontSize(8);
      doc.text(`Medication ${i + 1}`, 12, y);
      y += 6;
      y = drawRow(doc, y, 'Drug Name', m.name ?? '');
      if (m.strength) y = drawRow(doc, y, 'Strength', m.strength);
      if (m.sig) y = drawRow(doc, y, 'Sig', m.sig);
      if (m.quantity !== undefined) y = drawRow(doc, y, 'Quantity', String(m.quantity));
      if (m.refills !== undefined) y = drawRow(doc, y, 'Refills', String(m.refills));
      y += 3;
    });
    if (multi.clinical) {
      y = drawSectionHeader(doc, y, 'Clinical Information');
      if (multi.clinical.icd10) y = drawRow(doc, y, 'Primary ICD-10', multi.clinical.icd10);
      if (multi.clinical.notes) y = drawRow(doc, y, 'Clinical Notes', multi.clinical.notes);
    }
  }
  y += 5;

  // Approval stamp
  if (request.status === 'approved') {
    y = drawApprovalStamp(doc, y, request);
  }

  drawFooter(doc);
  await drawQRCode(doc, request.id);
  doc.save(`${docId}-${request.patientName.replace(/\s+/g, '-')}.pdf`);
}

// ─── Unified export ───────────────────────────────────────────────────────────

export async function exportRequestPDF(request: Request): Promise<void> {
  if (request.type === 'dme') {
    await generateDMERequestPDF(request);
  } else {
    await generateMedicationOrderPDF(request);
  }
}

// ─── CMS-1500 Pre-fill (Phase 3 §3.2) ────────────────────────────────────────

/**
 * Generate a CMS-1500-style insurance claim pre-fill document for a DME request.
 * Populates all fields derivable from the portal record; leaves blanks for fields
 * that require payer-specific data (NPI, billing codes, insured address).
 *
 * The output is NOT the official CMS-1500 scanned form — it is a structured
 * document formatted for staff to manually transfer values to payer systems or
 * attach as supporting documentation.
 */
export async function generateCMS1500PDF(request: Request): Promise<void> {
  const doc   = new jsPDF({ unit: 'mm', format: 'letter' });
  const docId = `CMS-${request.id.slice(0, 8).toUpperCase()}`;
  const pageW = doc.internal.pageSize.getWidth();

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PARRISH HEALTH — CMS-1500 CLAIM PRE-FILL', 12, 10);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('For staff use — transfer values to official CMS-1500 or payer portal', 12, 16);
  doc.text(`Doc ID: ${docId}  |  Generated: ${formatDate(Date.now())}`, pageW - 12, 16, { align: 'right' });

  let y = 28;

  // ── Disclaimer ──────────────────────────────────────────────────────────────
  doc.setFillColor(254, 243, 199); // amber-50
  doc.setDrawColor(251, 191, 36);  // amber-400
  doc.setLineWidth(0.3);
  doc.roundedRect(12, y, pageW - 24, 10, 1, 1, 'FD');
  doc.setTextColor(120, 80, 0);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(
    'This document pre-populates known fields only. Review all values before submission to payer.',
    pageW / 2, y + 6.5, { align: 'center' }
  );
  y += 16;

  const dme = request.details as DMERequestDetails;

  // ── Box 2: Patient Name ──────────────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Patient Information (Boxes 1–13)');
  y = drawRow(doc, y, 'Box 2 — Patient Name',           request.patientName);
  y = drawRow(doc, y, 'Box 1a — Insured ID / MRN',      request.patientId);
  y = drawRow(doc, y, 'Box 3 — DOB / Sex',              '(obtain from patient record)');
  y = drawRow(doc, y, 'Box 4 — Insured Name',           '(obtain from patient record)');
  y = drawRow(doc, y, 'Box 5 — Patient Address',        '(obtain from patient record)');
  y = drawRow(doc, y, 'Box 6 — Patient Relationship',   '(Self / Spouse / Child / Other)');
  y = drawRow(doc, y, 'Box 11 — Insured Policy / Group','(obtain from insurance card)');
  y += 3;

  // ── Box 21: Diagnosis Codes ──────────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Diagnosis Codes (Box 21)');
  y = drawRow(doc, y, '21A — Primary ICD-10',   dme.clinical?.icd10 ?? '');
  if (dme.clinical?.secondaryIcd10) {
    y = drawRow(doc, y, '21B — Secondary ICD-10', dme.clinical.secondaryIcd10);
  }
  y += 3;

  // ── Box 24: Service Information ──────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Service / Procedure (Box 24)');
  y = drawRow(doc, y, '24A — Date of Service',     request.createdAt ? formatDate(request.createdAt) : '');
  y = drawRow(doc, y, '24B — Place of Service',    '12 (Home)');
  y = drawRow(doc, y, '24D — HCPCS / Procedure',   '(select appropriate DME HCPCS code)');
  y = drawRow(doc, y, '24E — Diagnosis Pointer',   'A');
  y = drawRow(doc, y, '24F — Charges',             '(obtain from supplier)');
  y = drawRow(doc, y, '24G — Days / Units',        '1');
  y += 3;

  // ── Boxes 31–33: Supplier Information ────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Supplier / Physician Information (Boxes 31–33)');
  y = drawRow(doc, y, 'Box 17 — Referring Provider',    request.submitterName);
  y = drawRow(doc, y, 'Box 31 — Physician Signature',   `${request.submitterName}  (electronic — ${formatDate(request.processedAt ?? request.createdAt)})`);
  y = drawRow(doc, y, 'Box 32 — Service Facility',      'Parrish Health Systems');
  y = drawRow(doc, y, 'Box 33 — Billing Provider',      'Parrish Health Systems');
  y = drawRow(doc, y, 'NPI / Tax ID',                   '(obtain from billing department)');
  y += 3;

  // ── Equipment details ─────────────────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Equipment Details (Reference)');
  y = drawRow(doc, y, 'Category',            dme.equipment?.category ?? '');
  y = drawRow(doc, y, 'Item',                dme.equipment?.item ?? '');
  y = drawRow(doc, y, 'Prior Authorization', dme.clinical?.priorAuth ?? 'Not required');
  y = drawRow(doc, y, 'Length of Need',      dme.clinical?.lengthOfNeed ?? '');
  y = drawRow(doc, y, 'Clinical Justification', dme.clinical?.justification ?? '');
  y += 5;

  // ── Approval stamp if approved ────────────────────────────────────────────
  if (request.status === 'approved') {
    y = drawApprovalStamp(doc, y, request);
  }

  drawFooter(doc);
  await drawQRCode(doc, request.id);
  doc.save(`${docId}-CMS1500-${request.patientName.replace(/\s+/g, '-')}.pdf`);
}
