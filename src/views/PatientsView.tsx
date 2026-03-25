import { useState } from "react";
import { T } from "../tokens";
import Card from "../components/Card";
import Icon from "../components/Icon";
import { calcAge, fmtShortDate } from "../utils/formatting";
import { roleLabel } from "../utils/statusHelpers";
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
  patients: Patient[];
  requests: Request[];
  staff: Staff[];
  onSelectPatient: (patient: Patient) => void;
}

export default function PatientsView({
  patients,
  requests,
  staff,
  onSelectPatient,
}: PatientsViewProps) {
  const [query, setQuery] = useState("");

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
      </div>

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
