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
 *
 * No PHI leaves the browser — all generation is client-side.
 */

import jsPDF from 'jspdf';
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

// ─── DME Request PDF ──────────────────────────────────────────────────────────

export function generateDMERequestPDF(request: Request): void {
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
  doc.save(`${docId}-${request.patientName.replace(/\s+/g, '-')}.pdf`);
}

// ─── Medication Order PDF ─────────────────────────────────────────────────────

export function generateMedicationOrderPDF(request: Request): void {
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
  doc.save(`${docId}-${request.patientName.replace(/\s+/g, '-')}.pdf`);
}

// ─── Unified export ───────────────────────────────────────────────────────────

export function exportRequestPDF(request: Request): void {
  if (request.type === 'dme') {
    generateDMERequestPDF(request);
  } else {
    generateMedicationOrderPDF(request);
  }
}
