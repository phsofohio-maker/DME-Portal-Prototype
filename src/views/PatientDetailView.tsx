import { T } from "../tokens";
import BackBtn from "../components/BackBtn";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import InfoRow from "../components/InfoRow";
import RequestRows from "../components/RequestRows";
import { calcAge, fmtDate, fmtShortDate } from "../utils/formatting";
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

function extractIcd(condition: string): string {
  const match = condition.match(/\(([A-Z0-9.]+)\)$/);
  return match?.[1] ?? "";
}

interface PatientDetailViewProps {
  patient: Patient;
  requests: Request[];
  staff: Staff[];
  onBack: () => void;
  onNewRequest: (patientId: string) => void;
  onSelectRequest: (req: Request) => void;
}

export default function PatientDetailView({
  patient,
  requests,
  staff,
  onBack,
  onNewRequest,
  onSelectRequest,
}: PatientDetailViewProps) {
  const color = patientColor(patient.id);
  const initials = patientInitials(patient.name).toUpperCase();
  const age = calcAge(patient.dob);
  const nurse = staff.find((s) => s.uid === patient.primaryNurse);
  const patientRequests = requests.filter((r) => r.patientId === patient.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 800 }}>

      {/* Top nav row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn onClick={onBack} label="Back to Patients" />
        <Btn variant="primary" icon="plus" onClick={() => onNewRequest(patient.id)}>
          New Request
        </Btn>
      </div>

      {/* Patient header */}
      <Card>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Avatar */}
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: color + "18",
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          {/* Name + identifiers */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontFamily: T.fontDisplay,
                fontSize: 26,
                fontWeight: 400,
                color: T.text,
                marginBottom: 4,
                lineHeight: 1.2,
              }}
            >
              {patient.name}
            </h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: T.textSub }}>
                <strong style={{ color: T.text }}>{patient.mrn}</strong>
              </span>
              <span style={{ fontSize: 13, color: T.textSub }}>
                DOB: {fmtShortDate(patient.dob)} ({age} yrs)
              </span>
              <span style={{ fontSize: 13, color: T.textSub }}>
                Admitted: {fmtDate(patient.admittedDate)}
              </span>
            </div>
          </div>

          {/* Status badge */}
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              background: patient.status === "active" ? T.accentLight : T.bgSub,
              color: patient.status === "active" ? T.accent : T.textSub,
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {patient.status === "active" ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Info grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
            marginTop: 24,
            paddingTop: 20,
            borderTop: `1px solid ${T.borderLight}`,
          }}
        >
          <InfoRow label="Insurance" value={patient.insurance} />
          <InfoRow label="Phone"     value={patient.phone} />
          <InfoRow label="Address"   value={patient.address} />
          <InfoRow
            label="Primary Nurse"
            value={
              nurse ? (
                <span>
                  {nurse.displayName}
                  <span style={{ color: T.textLight }}> · {nurse.email}</span>
                </span>
              ) : (
                "Unassigned"
              )
            }
          />
        </div>
      </Card>

      {/* Allergy alert */}
      {patient.allergies.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            background: T.urgentLight,
            border: `1px solid ${T.urgent}30`,
            borderRadius: T.radiusSm,
          }}
        >
          <Icon name="alert" size={18} color={T.urgent} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.urgent, marginBottom: 3 }}>
              Known Allergies
            </p>
            <p style={{ fontSize: 13, color: T.urgent }}>
              {patient.allergies.join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Conditions */}
      <Card>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.textSub,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            marginBottom: 14,
          }}
        >
          Diagnoses & Conditions
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {patient.conditions.map((c) => {
            const icd = extractIcd(c);
            return (
              <div
                key={c}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.info,
                    background: T.infoLight,
                    padding: "2px 6px",
                    borderRadius: 4,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: 0.3,
                  }}
                >
                  {icd || "—"}
                </span>
                <span style={{ fontSize: 14, color: T.text }}>{stripIcd(c)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Clinical notes */}
      {patient.clinicalNotes && (
        <Card>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T.textSub,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 12,
            }}
          >
            Clinical Notes
          </h3>
          <p style={{ fontSize: 14, color: T.text, lineHeight: 1.65 }}>
            {patient.clinicalNotes}
          </p>
        </Card>
      )}

      {/* Request history */}
      <Card padding={0}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: patientRequests.length > 0 ? `1px solid ${T.borderLight}` : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
            Request History
          </h3>
          <span
            style={{
              fontSize: 12,
              color: T.textSub,
              background: T.bgSub,
              padding: "2px 8px",
              borderRadius: 10,
            }}
          >
            {patientRequests.length}
          </span>
        </div>
        <RequestRows
          requests={patientRequests}
          patients={[patient]}
          staff={staff}
          onSelect={onSelectRequest}
          emptyTitle="No requests yet"
          emptySubtitle="Requests for this patient will appear here."
        />
      </Card>
    </div>
  );
}
