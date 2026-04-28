import { useState } from "react";
import { firebaseService } from "../services/firebaseService";
import { T } from "../tokens";
import BackBtn from "../components/BackBtn";
import Btn from "../components/Btn";
import Card from "../components/Card";
import InfoRow from "../components/InfoRow";
import StatusPill from "../components/StatusPill";
import TypeBadge from "../components/TypeBadge";
import Icon from "../components/Icon";
import { fmtDateTime, fmtShortDate } from "../utils/formatting";
import { reqTitle } from "../utils/statusHelpers";
import { exportRequestPdf } from "../utils/pdfExport";
import { frequencyLabel } from "../data/frequencyOptions";
import { adminActionSchema } from "../lib/schemas";
import { useToast } from "../hooks/useToast";
import type { Staff, Request, Patient, RequestStatus, HistoryEntry } from "../types";

const STATUS_TOAST_LABELS: Record<RequestStatus, string> = {
  pending:  "Marked pending",
  approved: "Request approved",
  denied:   "Request denied",
  rmi:      "More info requested",
  filled:   "Request marked as filled",
};

// ─── History helpers ──────────────────────────────────────────────────────────

const HISTORY_COLORS: Record<string, string> = {
  created:  T.accent,
  approved: T.accent,
  denied:   T.urgent,
  rmi:      T.warn,
  filled:   T.purple,
  updated:  T.info,
};

const HISTORY_LABELS: Record<string, string> = {
  created:  "Request submitted",
  approved: "Approved",
  denied:   "Denied",
  rmi:      "More info requested",
  filled:   "Filled",
  updated:  "Updated",
};

function HistoryRow({ entry, isLast }: { entry: HistoryEntry; isLast: boolean }) {
  const color = HISTORY_COLORS[entry.action] ?? T.textSub;
  const label = HISTORY_LABELS[entry.action] ?? entry.action;

  return (
    <div style={{ display: "flex", gap: 14 }}>
      {/* Timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            marginTop: 3,
          }}
        />
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: T.borderLight, minHeight: 16, marginTop: 3 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</span>
          <span style={{ fontSize: 12, color: T.textLight }}>
            by {entry.actorName}
            <span style={{ color: T.textLight, fontWeight: 400 }}> · {entry.actorRole.replace("_", " ")}</span>
          </span>
          <span style={{ fontSize: 11, color: T.textLight, marginLeft: "auto" }}>
            {fmtDateTime(entry.timestamp)}
          </span>
        </div>
        {entry.notes && (
          <p style={{ fontSize: 13, color: T.textSub, marginTop: 4, lineHeight: 1.55 }}>
            {entry.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface RequestDetailViewProps {
  user: Staff;
  request: Request;
  patients: Patient[];
  staff: Staff[];
  onBack: () => void;
  backLabel?: string;
}

export default function RequestDetailView({
  user,
  request,
  patients,
  staff,
  onBack,
  backLabel = "Back to Requests",
}: RequestDetailViewProps) {
  const toast = useToast();
  const [adminNotes, setAdminNotes] = useState(request.adminNotes ?? "");
  const [actionLoading, setActionLoading] = useState<RequestStatus | null>(null);
  const [actionError, setActionError] = useState("");
  const [notesError, setNotesError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);

  const patient  = patients.find((p) => p.id === request.patientId);
  const submitter = staff.find((s) => s.uid === request.submittedBy);
  const processor = staff.find((s) => s.uid === request.processedBy);
  const isAdmin = user.role === "admin";
  const canAct  = isAdmin && (request.status === "pending" || request.status === "rmi");
  const canMarkFilled = isAdmin && request.status === "approved" && request.details.type === "dme";

  async function handleAction(newStatus: RequestStatus) {
    const parsed = adminActionSchema.safeParse({ action: newStatus, notes: adminNotes });
    if (!parsed.success) {
      const noteErr = parsed.error.issues.find((i) => i.path.includes("notes"));
      setNotesError(noteErr?.message ?? "Validation failed.");
      return;
    }
    setNotesError("");
    setActionError("");
    setActionLoading(newStatus);
    try {
      await firebaseService.updateRequestStatus(
        request.id,
        newStatus,
        adminNotes.trim(),
        user,
        request.status
      );
      toast.success(STATUS_TOAST_LABELS[newStatus]);
      onBack();
    } catch {
      setActionError("Failed to update request. Please try again.");
      toast.error("Failed to update request");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkFilled() {
    setActionError("");
    setActionLoading("filled");
    try {
      await firebaseService.markFilled(request.id, user, request.status);
      toast.success("Request marked as filled");
      onBack();
    } catch {
      setActionError("Failed to mark as filled. Please try again.");
      toast.error("Failed to mark as filled");
    } finally {
      setActionLoading(null);
    }
  }

  function handleExport() {
    setPdfExporting(true);
    // Yield to the browser so the button updates before the (sync) PDF work
    setTimeout(() => {
      exportRequestPdf(request, patient, submitter, processor);
      setPdfExporting(false);
    }, 50);
  }

  const { details } = request;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 780 }}>

      {/* Back */}
      <BackBtn onClick={onBack} label={backLabel} />

      {/* Header card */}
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <TypeBadge type={details.type} />
              <StatusPill status={request.status} />
            </div>
            <h2
              style={{
                fontFamily: T.fontDisplay,
                fontSize: 24,
                fontWeight: 400,
                color: T.text,
                lineHeight: 1.25,
              }}
            >
              {reqTitle(request)}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: T.textLight,
                background: T.bgSub,
                padding: "3px 8px",
                borderRadius: 4,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              {request.id.toUpperCase()}
            </span>
            <Btn
              variant="secondary"
              size="sm"
              icon="download"
              onClick={handleExport}
              disabled={pdfExporting}
            >
              {pdfExporting ? "Generating…" : "Export PDF"}
            </Btn>
          </div>
        </div>

        {/* Meta grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
            paddingTop: 16,
            borderTop: `1px solid ${T.borderLight}`,
          }}
        >
          <InfoRow
            label="Patient"
            value={
              patient ? (
                <span>
                  {patient.name}
                  <span style={{ color: T.textLight }}> · {patient.mrn}</span>
                </span>
              ) : "Unknown"
            }
          />
          <InfoRow
            label="Submitted by"
            value={
              submitter
                ? `${submitter.displayName} (${submitter.role.replace("_", " ")})`
                : "Unknown"
            }
          />
          <InfoRow label="Submitted"  value={fmtDateTime(request.createdAt)} />
          {patient && (
            <InfoRow label="Insurance"  value={patient.insurance} />
          )}
        </div>
      </Card>

      {/* Type-specific details */}
      <Card>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.textSub,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            marginBottom: 16,
          }}
        >
          Request Details
        </h3>

        {details.type === "dme" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <InfoRow label="Equipment"    value={details.equipmentName} />
              <InfoRow
                label="Urgency"
                value={
                  <span
                    style={{
                      textTransform: "capitalize",
                      color: details.urgency === "emergent" ? T.urgent : details.urgency === "urgent" ? T.warn : T.text,
                      fontWeight: details.urgency !== "routine" ? 600 : 400,
                    }}
                  >
                    {details.urgency}
                  </span>
                }
              />
            </div>
            {details.icd10Code && (
              <InfoRow
                label="ICD-10 Diagnosis"
                value={
                  <span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: T.info,
                        background: T.infoLight,
                        padding: "2px 6px",
                        borderRadius: 4,
                        marginRight: 8,
                      }}
                    >
                      {details.icd10Code}
                    </span>
                    {details.icd10Description}
                  </span>
                }
              />
            )}
            <InfoRow label="Clinical Justification" value={
              <p style={{ lineHeight: 1.65, color: T.text }}>{details.justification}</p>
            } />
          </div>
        )}

        {details.type === "medication" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <InfoRow
                label="Medication"
                value={
                  <span>
                    {details.drugName}
                    <span style={{ fontSize: 12, color: T.textLight, marginLeft: 6 }}>RxCUI {details.rxcui}</span>
                  </span>
                }
              />
              <InfoRow label="Pharmacy" value={details.pharmacy} />
            </div>
            {(details.strength || details.doseForm || details.route) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {details.strength && <InfoRow label="Strength" value={details.strength} />}
                {details.doseForm && <InfoRow label="Dose Form" value={details.doseForm} />}
                {details.route && <InfoRow label="Route" value={details.route} />}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {details.frequency && <InfoRow label="Frequency" value={frequencyLabel(details.frequency)} />}
              <InfoRow label="Quantity" value={`${details.quantity} units`} />
              <InfoRow label="Refills" value={details.refills.toString()} />
            </div>
            {details.startDate && (
              <InfoRow label="Start Date" value={details.startDate} />
            )}
            {details.indication && (
              <InfoRow
                label="Indication"
                value={
                  <span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.info, background: T.infoLight, padding: "2px 6px", borderRadius: 4, marginRight: 8 }}>
                      {details.indication.code}
                    </span>
                    {details.indication.description}
                  </span>
                }
              />
            )}
            {details.justification && (
              <InfoRow
                label="Notes"
                value={<p style={{ lineHeight: 1.65 }}>{details.justification}</p>}
              />
            )}
          </div>
        )}

        {details.type === "multi_medication" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Shared fields */}
            {(details.startDate || details.indication) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {details.startDate && <InfoRow label="Start Date" value={details.startDate} />}
                {details.indication && (
                  <InfoRow
                    label="Indication"
                    value={
                      <span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.info, background: T.infoLight, padding: "2px 6px", borderRadius: 4, marginRight: 8 }}>
                          {details.indication.code}
                        </span>
                        {details.indication.description}
                      </span>
                    }
                  />
                )}
              </div>
            )}
            {/* Drug table */}
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 70px 70px 60px 60px",
                  gap: "0 12px",
                  padding: "7px 10px",
                  background: T.bgSub,
                  borderRadius: `${T.radiusSm} ${T.radiusSm} 0 0`,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {["Medication", "Freq", "Strength", "Form", "Qty", "Refills"].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {h}
                  </span>
                ))}
              </div>
              {details.drugs.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 70px 70px 60px 60px",
                    gap: "0 12px",
                    padding: "10px 10px",
                    borderBottom: i < details.drugs.length - 1 ? `1px solid ${T.borderLight}` : undefined,
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderTop: "none",
                    ...(i === details.drugs.length - 1
                      ? { borderRadius: `0 0 ${T.radiusSm} ${T.radiusSm}` }
                      : {}),
                  }}
                >
                  <div>
                    <span style={{ fontSize: 14, color: T.text }}>{d.drugName}</span>
                    <span style={{ fontSize: 11, color: T.textLight, marginLeft: 6 }}>RxCUI {d.rxcui}</span>
                  </div>
                  <span style={{ fontSize: 13, color: T.text }}>{d.frequency ? frequencyLabel(d.frequency) : "—"}</span>
                  <span style={{ fontSize: 13, color: T.text }}>{d.strength || "—"}</span>
                  <span style={{ fontSize: 13, color: T.text }}>{d.doseForm || "—"}</span>
                  <span style={{ fontSize: 14, color: T.text }}>{d.quantity}</span>
                  <span style={{ fontSize: 14, color: T.text }}>{d.refills}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <InfoRow label="Pharmacy" value={details.pharmacy} />
              {details.justification && (
                <InfoRow label="Notes" value={details.justification} />
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Patient allergies alert */}
      {patient && patient.allergies.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 14px",
            background: T.urgentLight,
            border: `1px solid ${T.urgent}30`,
            borderRadius: T.radiusSm,
          }}
        >
          <Icon name="alert" size={16} color={T.urgent} />
          <p style={{ fontSize: 13, color: T.urgent }}>
            <strong>Patient allergies: </strong>{patient.allergies.join(", ")}
          </p>
        </div>
      )}

      {/* Admin notes / processing info */}
      {(request.adminNotes || request.processedAt) && (
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
            Admin Review
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {request.adminNotes && (
              <InfoRow
                label="Notes"
                value={<p style={{ lineHeight: 1.65 }}>{request.adminNotes}</p>}
              />
            )}
            {request.processedAt && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InfoRow
                  label="Processed by"
                  value={processor ? processor.displayName : "Unknown"}
                />
                <InfoRow
                  label="Processed"
                  value={fmtDateTime(request.processedAt)}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Admin action panel */}
      {canAct && (
        <Card style={{ border: `1px solid ${T.border}` }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T.textSub,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 16,
            }}
          >
            Admin Action
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.textSub,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => { setAdminNotes(e.target.value); setNotesError(""); }}
                placeholder="Add a note for the staff member (required for Deny or Request Info)…"
                rows={3}
                style={{
                  width: "100%",
                  fontSize: 14,
                  color: T.text,
                  background: T.bgCard,
                  border: `1px solid ${notesError ? T.urgent : T.border}`,
                  borderRadius: T.radiusSm,
                  padding: "10px 12px",
                  outline: "none",
                  fontFamily: T.font,
                  resize: "vertical",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                  transition: "border-color 0.12s",
                }}
              />
              {notesError && (
                <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500, marginTop: 4, display: "block" }}>
                  {notesError}
                </span>
              )}
              {actionError && (
                <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500, marginTop: 4, display: "block" }}>
                  {actionError}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Btn
                variant="primary"
                icon="check"
                onClick={() => handleAction("approved")}
                disabled={actionLoading !== null}
              >
                {actionLoading === "approved" ? "Approving…" : "Approve"}
              </Btn>
              <Btn
                variant="secondary"
                icon="requests"
                onClick={() => handleAction("rmi")}
                disabled={actionLoading !== null}
              >
                {actionLoading === "rmi" ? "Sending…" : "Request Info"}
              </Btn>
              <Btn
                variant="danger"
                icon="x"
                onClick={() => handleAction("denied")}
                disabled={actionLoading !== null}
              >
                {actionLoading === "denied" ? "Denying…" : "Deny"}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Mark as Filled (DME fulfillment tracking) */}
      {canMarkFilled && (
        <Card style={{ border: `1px solid ${T.border}` }}>
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
            Fulfillment
          </h3>
          <p style={{ fontSize: 13, color: T.textSub, marginBottom: 14, lineHeight: 1.55 }}>
            Mark this DME request as filled once the equipment has been delivered to the patient.
          </p>
          {actionError && (
            <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500, marginBottom: 8, display: "block" }}>
              {actionError}
            </span>
          )}
          <Btn
            variant="primary"
            icon="check"
            onClick={handleMarkFilled}
            disabled={actionLoading !== null}
          >
            {actionLoading === "filled" ? "Saving…" : "Mark as Filled"}
          </Btn>
        </Card>
      )}

      {/* Document history */}
      {request.history && request.history.length > 0 && (
        <Card>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T.textSub,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 16,
            }}
          >
            Document History
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[...request.history]
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((entry, i, arr) => (
                <HistoryRow
                  key={i}
                  entry={entry}
                  isLast={i === arr.length - 1}
                />
              ))}
          </div>
        </Card>
      )}

      {/* Submitted info footer */}
      <p style={{ fontSize: 12, color: T.textLight, paddingBottom: 8 }}>
        Submitted {fmtDateTime(request.createdAt)}
        {submitter ? ` by ${submitter.displayName}` : ""}
        {patient ? ` · Patient: ${patient.name} (${patient.mrn})` : ""}
        {patient?.dob ? ` · DOB: ${fmtShortDate(patient.dob)}` : ""}
      </p>
    </div>
  );
}
