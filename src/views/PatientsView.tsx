import { useState } from "react";
import { T } from "../tokens";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Btn from "../components/Btn";
import Input from "../components/Input";
import Select from "../components/Select";
import { calcAge, fmtShortDate } from "../utils/formatting";
import { roleLabel } from "../utils/statusHelpers";
import { patientFormSchema, fieldErrors } from "../lib/schemas";
import { patientService } from "../services/patientService";
import { useToast } from "../hooks/useToast";
import type { Patient, Staff, Request } from "../types";

const PATIENT_COLORS = [T.info, T.warn, T.purple, T.accent, "#C4693A", "#5C8FA0"];

function patientColor(id: string): string {
  const idx = parseInt(id.replace(/\D/g, ""), 10) % PATIENT_COLORS.length;
  return PATIENT_COLORS[idx] ?? T.accent;
}

function patientInitials(name: string): string {
  const parts = name.trim().split(" ");
  return (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "");
}

function stripIcd(condition: string): string {
  return condition.replace(/\s*\([A-Z0-9.]+\)\s*$/, "").trim();
}

interface PatientsViewProps {
  user: Staff;
  patients: Patient[];
  requests: Request[];
  staff: Staff[];
  onSelectPatient: (patient: Patient) => void;
  onPatientAdded: () => void;
}

export default function PatientsView({
  user,
  patients,
  requests,
  staff,
  onSelectPatient,
  onPatientAdded,
}: PatientsViewProps) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const canAdd = user.role === "admin" || user.role === "nurse";

  const filtered = query.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.mrn.toLowerCase().includes(query.toLowerCase())
      )
    : patients;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>

      {/* Header + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <Icon name="search" size={15} color={T.textLight} />
          </span>
          <input
            type="text"
            placeholder="Search by name or MRN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px 9px 34px",
              fontSize: 14,
              color: T.text,
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              outline: "none",
              fontFamily: T.font,
            }}
          />
        </div>
        <p style={{ fontSize: 13, color: T.textSub, flexShrink: 0 }}>
          {filtered.length} patient{filtered.length !== 1 ? "s" : ""}
          {query ? ` matching "${query}"` : ""}
        </p>
        {canAdd && (
          <div style={{ marginLeft: "auto" }}>
            <Btn variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
              Add Patient
            </Btn>
          </div>
        )}
      </div>

      {modalOpen && (
        <AddPatientModal
          staff={staff}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); onPatientAdded(); }}
        />
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: 48,
            gap: 10,
          }}
        >
          <Icon name="patients" size={32} color={T.textLight} />
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>No patients found</p>
          <p style={{ fontSize: 13, color: T.textLight }}>Try a different name or MRN</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              requests={requests}
              staff={staff}
              onClick={() => onSelectPatient(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Patient card ─────────────────────────────────────────────────────────────

function PatientCard({
  patient,
  requests,
  staff,
  onClick,
}: {
  patient: Patient;
  requests: Request[];
  staff: Staff[];
  onClick: () => void;
}) {
  const color = patientColor(patient.id);
  const initials = patientInitials(patient.name).toUpperCase();
  const age = calcAge(patient.dob);
  const nurse = staff.find((s) => s.uid === patient.primaryNurse);
  const reqCount = requests.filter((r) => r.patientId === patient.id).length;
  const visibleConditions = patient.conditions.slice(0, 3);
  const extraConditions = patient.conditions.length - 3;

  return (
    <Card hoverable onClick={onClick}>
      {/* Header row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: color + "18",
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: T.fontDisplay,
              fontSize: 17,
              fontWeight: 400,
              color: T.text,
              lineHeight: 1.25,
              marginBottom: 2,
            }}
          >
            {patient.name}
          </p>
          <p style={{ fontSize: 12, color: T.textSub }}>
            {patient.mrn} · {age} yrs · {patient.insurance}
          </p>
        </div>

        {/* Allergy warning */}
        {patient.allergies.length > 0 && (
          <div
            title={`Allergies: ${patient.allergies.join(", ")}`}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: T.urgentLight,
            }}
          >
            <Icon name="alert" size={14} color={T.urgent} />
          </div>
        )}
      </div>

      {/* Conditions */}
      {patient.conditions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {visibleConditions.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: 4,
                background: T.bgSub,
                color: T.textSub,
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={c}
            >
              {stripIcd(c)}
            </span>
          ))}
          {extraConditions > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: 4,
                background: T.bgSub,
                color: T.textLight,
              }}
            >
              +{extraConditions} more
            </span>
          )}
        </div>
      )}

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 12,
          borderTop: `1px solid ${T.borderLight}`,
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="user" size={13} color={T.textLight} />
          <span style={{ fontSize: 12, color: T.textSub }}>
            {nurse ? nurse.displayName : "Unassigned"}
          </span>
          <span style={{ fontSize: 12, color: T.textLight }}>·</span>
          <span style={{ fontSize: 12, color: T.textLight }}>{roleLabel(nurse?.role ?? "nurse")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="requests" size={13} color={T.textLight} />
          <span style={{ fontSize: 12, color: T.textSub }}>{reqCount} request{reqCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Admitted */}
      <p style={{ fontSize: 11, color: T.textLight, marginTop: 7 }}>
        Admitted {fmtShortDate(patient.admittedDate)}
      </p>
    </Card>
  );
}

// ─── Add Patient modal ────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function splitList(s: string | undefined): string[] {
  return (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

interface PatientFormValues {
  name: string;
  dob: string;
  mrn: string;
  insurance: string;
  phone: string;
  address: string;
  primaryNurse: string;
  allergies: string;
  conditions: string;
  clinicalNotes: string;
  admittedDate: string;
}

function AddPatientModal({
  staff,
  onClose,
  onCreated,
}: {
  staff: Staff[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const nurses = staff.filter((s) => s.role === "nurse" && s.status === "active");

  const [vals, setVals] = useState<PatientFormValues>({
    name:          "",
    dob:           "",
    mrn:           "",
    insurance:     "",
    phone:         "",
    address:       "",
    primaryNurse:  "",
    allergies:     "",
    conditions:    "",
    clinicalNotes: "",
    admittedDate:  todayISO(),
  });
  const [errors, setErrors] = useState<Partial<PatientFormValues>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function set<K extends keyof PatientFormValues>(k: K, v: string) {
    setVals((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: "" }));
  }

  async function handleSubmit() {
    const result = patientFormSchema.safeParse(vals);
    if (!result.success) {
      setErrors(fieldErrors(result) as Partial<PatientFormValues>);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await patientService.create({
        name:          vals.name.trim(),
        dob:           vals.dob,
        mrn:           vals.mrn.trim(),
        insurance:     vals.insurance.trim(),
        phone:         vals.phone.trim(),
        address:       vals.address.trim(),
        primaryNurse:  vals.primaryNurse,
        allergies:     splitList(vals.allergies),
        conditions:    splitList(vals.conditions),
        clinicalNotes: vals.clinicalNotes.trim(),
        status:        "active",
        admittedDate:  vals.admittedDate,
      });
      toast.success("Patient added");
      onCreated();
    } catch {
      setSubmitError("Failed to add patient. Please try again.");
      toast.error("Failed to add patient");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 18, 16, 0.42)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 20px",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 22, color: T.text }}>Add Patient</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: T.textLight }}
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input
              label="Full name"
              required
              value={vals.name}
              onChange={(e) => set("name", e.target.value)}
              error={errors.name}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Input
                label="Date of birth"
                required
                type="date"
                value={vals.dob}
                onChange={(e) => set("dob", e.target.value)}
                error={errors.dob}
              />
              <Input
                label="MRN"
                required
                placeholder="MRN-00000"
                value={vals.mrn}
                onChange={(e) => set("mrn", e.target.value)}
                error={errors.mrn}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Input
                label="Insurance"
                required
                placeholder="e.g. Medicare Part A & B"
                value={vals.insurance}
                onChange={(e) => set("insurance", e.target.value)}
                error={errors.insurance}
              />
              <Input
                label="Phone"
                required
                placeholder="(614) 555-0000"
                value={vals.phone}
                onChange={(e) => set("phone", e.target.value)}
                error={errors.phone}
              />
            </div>

            <Input
              label="Address"
              required
              value={vals.address}
              onChange={(e) => set("address", e.target.value)}
              error={errors.address}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Select
                label="Primary nurse"
                required
                value={vals.primaryNurse}
                onChange={(e) => set("primaryNurse", e.target.value)}
                error={errors.primaryNurse}
              >
                <option value="">Select a nurse…</option>
                {nurses.map((n) => (
                  <option key={n.uid} value={n.uid}>{n.displayName}</option>
                ))}
              </Select>
              <Input
                label="Admitted date"
                required
                type="date"
                value={vals.admittedDate}
                onChange={(e) => set("admittedDate", e.target.value)}
                error={errors.admittedDate}
              />
            </div>

            <Input
              label="Allergies"
              hint="Comma-separated. Leave blank if none."
              placeholder="Penicillin, Latex"
              value={vals.allergies}
              onChange={(e) => set("allergies", e.target.value)}
            />

            <Input
              label="Conditions"
              hint="Comma-separated. Include ICD-10 in parens, e.g. 'Hypertension (I10)'."
              placeholder="Type 2 Diabetes (E11.9), Hypertension (I10)"
              value={vals.conditions}
              onChange={(e) => set("conditions", e.target.value)}
            />

            <Input
              as="textarea"
              label="Clinical notes"
              rows={3}
              value={vals.clinicalNotes}
              onChange={(e) => set("clinicalNotes", (e.target as HTMLTextAreaElement).value)}
            />

            {submitError && (
              <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{submitError}</span>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
              <Btn variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Btn>
              <Btn variant="primary" icon="check" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Adding…" : "Add Patient"}
              </Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
