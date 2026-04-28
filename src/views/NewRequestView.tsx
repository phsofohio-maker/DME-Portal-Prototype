import { useState } from "react";
import { T } from "../tokens";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import Select from "../components/Select";
import BackBtn from "../components/BackBtn";
import DrugSearch from "../components/DrugSearch";
import Icd10Search from "../components/Icd10Search";
import { calcAge } from "../utils/formatting";
import { typeInfo } from "../utils/statusHelpers";
import { DME_CATALOG } from "../data/dmeCatalog";
import { firebaseService } from "../services/firebaseService";
import { FREQUENCY_OPTIONS } from "../data/frequencyOptions";
import { dmeFormSchema, medicationFormSchema, multiMedicationFormSchema, drugRowSchema, fieldErrors } from "../lib/schemas";
import { useToast } from "../hooks/useToast";
import type { Staff, Patient, RequestType, Drug } from "../types";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Patient snapshot ─────────────────────────────────────────────────────────

function PatientSnapshot({ patient }: { patient: Patient }) {
  const age = calcAge(patient.dob);
  const visible = patient.conditions.slice(0, 3);
  const extra   = patient.conditions.length - 3;
  return (
    <div
      style={{
        padding: "14px 16px",
        background: T.bgSub,
        border: `1px solid ${T.borderLight}`,
        borderRadius: T.radiusSm,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: patient.allergies.length > 0 || patient.conditions.length > 0 ? 10 : 0 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{patient.name}</p>
          <p style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
            {patient.mrn} · {age} yrs · {patient.insurance}
          </p>
        </div>
      </div>
      {patient.allergies.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="alert" size={13} color={T.urgent} />
          <span style={{ fontSize: 12, color: T.urgent, fontWeight: 500 }}>
            Allergies: {patient.allergies.join(", ")}
          </span>
        </div>
      )}
      {visible.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {visible.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 4,
                background: T.bgCard,
                color: T.textSub,
                border: `1px solid ${T.border}`,
              }}
            >
              {c.replace(/\s*\([A-Z0-9.]+\)\s*$/, "")}
            </span>
          ))}
          {extra > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 4,
                background: T.bgCard,
                color: T.textLight,
                border: `1px solid ${T.border}`,
              }}
            >
              +{extra} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Type selector ─────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { type: RequestType; description: string }[] = [
  { type: "dme",              description: "Request durable medical equipment for a patient" },
  { type: "medication",       description: "Submit a single prescription refill request"     },
  { type: "multi_medication", description: "Batch multiple medications in one submission"    },
];

function TypeSelector({ onSelect }: { onSelect: (t: RequestType) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <div>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 400, color: T.text, marginBottom: 6 }}>
          What type of request?
        </h2>
        <p style={{ fontSize: 14, color: T.textSub }}>Select the request type to continue.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {TYPE_OPTIONS.map(({ type, description }) => {
          const info = typeInfo(type);
          return (
            <TypeCard
              key={type}
              icon={info.icon as Parameters<typeof Icon>[0]["name"]}
              label={info.label}
              description={description}
              color={info.color}
              bg={info.bg}
              onClick={() => onSelect(type)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TypeCard({
  icon,
  label,
  description,
  color,
  bg,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  description: string;
  color: string;
  bg: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 20,
        background: T.bgCard,
        border: `1px solid ${hovered ? color + "60" : T.borderLight}`,
        borderRadius: T.radius,
        boxShadow: hovered ? T.shadowLg : T.shadow,
        cursor: "pointer",
        transition: "all 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: hovered ? color + "28" : bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          transition: "background 0.15s",
        }}
      >
        <Icon name={icon} size={22} color={color} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

// ─── Confirmation screen ──────────────────────────────────────────────────────

function ConfirmationScreen({
  onSubmitAnother,
  onViewRequests,
}: {
  onSubmitAnother: () => void;
  onViewRequests: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        textAlign: "center",
        gap: 16,
        maxWidth: 440,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: T.accentLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Icon name="check" size={34} color={T.accent} />
      </div>
      <div>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 400, color: T.text, marginBottom: 8 }}>
          Request Submitted
        </h2>
        <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.6 }}>
          Your request has been submitted and is pending admin review. You'll be notified once a decision is made.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn variant="secondary" onClick={onSubmitAnother}>Submit Another</Btn>
        <Btn variant="primary" icon="requests" onClick={onViewRequests}>View Requests</Btn>
      </div>
    </div>
  );
}

// ─── Patient select + snapshot ────────────────────────────────────────────────

function PatientSelect({
  patients,
  value,
  onChange,
  error,
}: {
  patients: Patient[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const selected = patients.find((p) => p.id === value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Select
        label="Patient"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
      >
        <option value="">Select a patient…</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.mrn}
          </option>
        ))}
      </Select>
      {selected && <PatientSnapshot patient={selected} />}
    </div>
  );
}

// ─── DME form ─────────────────────────────────────────────────────────────────

interface DmeFormValues {
  patientId: string;
  equipmentId: string;
  customEquipmentName: string;
  icd10Code: string;
  icd10Description: string;
  urgency: string;
  justification: string;
}

function DmeForm({
  patients,
  preselectedPatient,
  user,
  onDone,
  onBack,
}: {
  patients: Patient[];
  preselectedPatient: string;
  user: Staff;
  onDone: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [vals, setVals] = useState<DmeFormValues>({
    patientId:           preselectedPatient,
    equipmentId:         "",
    customEquipmentName: "",
    icd10Code:           "",
    icd10Description:    "",
    urgency:             "routine",
    justification:       "",
  });
  const [errors, setErrors] = useState<Partial<DmeFormValues>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function set<K extends keyof DmeFormValues>(k: K, v: string) {
    setVals((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: "" }));
  }

  function validate(): boolean {
    const result = dmeFormSchema.safeParse(vals);
    if (result.success) { setErrors({}); return true; }
    setErrors(fieldErrors(result) as Partial<DmeFormValues>);
    return false;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const equipmentName = vals.equipmentId === "other"
      ? vals.customEquipmentName.trim()
      : DME_CATALOG.find((d) => d.id === vals.equipmentId)!.name;
    setSubmitting(true);
    setSubmitError("");
    try {
      await firebaseService.submitRequest({
        patientId:   vals.patientId,
        submittedBy: user.uid,
        details: {
          type:          "dme",
          equipmentId:   vals.equipmentId,
          equipmentName,
          ...(vals.icd10Code ? {
            icd10Code:        vals.icd10Code,
            icd10Description: vals.icd10Description,
          } : {}),
          urgency:       vals.urgency as "routine" | "urgent" | "emergent",
          justification: vals.justification,
        },
      }, user);
      toast.success("DME request submitted");
      onDone();
    } catch {
      setSubmitError("Failed to submit request. Please try again.");
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn onClick={onBack} label="Change type" />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.info, background: T.infoLight, padding: "3px 10px", borderRadius: 12 }}>
          DME Request
        </span>
      </div>

      <PatientSelect
        patients={patients}
        value={vals.patientId}
        onChange={(v) => set("patientId", v)}
        error={errors.patientId}
      />

      <Select
        label="Equipment"
        required
        value={vals.equipmentId}
        onChange={(e) => set("equipmentId", e.target.value)}
        error={errors.equipmentId}
      >
        <option value="">Select equipment…</option>
        {(["Mobility", "Beds & Mattresses", "Respiratory", "Bathroom Safety", "Seating", "Lifts & Transfers", "Accessories"] as const).map((cat) => (
          <optgroup key={cat} label={cat}>
            {DME_CATALOG.filter((d) => d.category === cat).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Other">
          <option value="other">Other (specify below)</option>
        </optgroup>
      </Select>

      {vals.equipmentId === "other" && (
        <Input
          label="Equipment name"
          required
          placeholder="Describe the requested item"
          value={vals.customEquipmentName}
          onChange={(e) => set("customEquipmentName", e.target.value)}
          error={errors.customEquipmentName}
        />
      )}

      <Icd10Search
        code={vals.icd10Code}
        description={vals.icd10Description}
        onSelect={(code, desc) => {
          setVals((v) => ({ ...v, icd10Code: code, icd10Description: desc }));
          setErrors((e) => ({ ...e, icd10Code: "" }));
        }}
        label="ICD-10 Diagnosis Code (optional)"
        error={errors.icd10Code}
      />

      <Select
        label="Urgency"
        required
        value={vals.urgency}
        onChange={(e) => set("urgency", e.target.value)}
        error={errors.urgency}
      >
        <option value="routine">Routine</option>
        <option value="urgent">Urgent</option>
        <option value="emergent">Emergent</option>
      </Select>

      <Input
        as="textarea"
        label="Clinical Justification"
        required
        rows={4}
        placeholder="Describe the medical necessity for this equipment…"
        value={vals.justification}
        onChange={(e) => set("justification", (e.target as HTMLTextAreaElement).value)}
        error={errors.justification}
      />

      {submitError && (
        <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{submitError}</span>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
        <Btn variant="primary" icon="check" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Request"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Medication form ──────────────────────────────────────────────────────────

interface MedFormValues {
  patientId: string;
  drugName: string;
  rxcui: string;
  strength: string;
  doseForm: string;
  route: string;
  frequency: string;
  startDate: string;
  indicationCode: string;
  indicationDesc: string;
  quantity: string;
  refills: string;
  pharmacy: string;
  justification: string;
}

function MedicationForm({
  patients,
  preselectedPatient,
  user,
  onDone,
  onBack,
}: {
  patients: Patient[];
  preselectedPatient: string;
  user: Staff;
  onDone: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [vals, setVals] = useState<MedFormValues>({
    patientId:      preselectedPatient,
    drugName:       "",
    rxcui:          "",
    strength:       "",
    doseForm:       "",
    route:          "",
    frequency:      "",
    startDate:      todayISO(),
    indicationCode: "",
    indicationDesc: "",
    quantity:       "30",
    refills:        "0",
    pharmacy:       "",
    justification:  "",
  });
  const [errors, setErrors] = useState<Partial<MedFormValues>>({});
  const [autoFilled, setAutoFilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function set<K extends keyof MedFormValues>(k: K, v: string) {
    setVals((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: "" }));
  }

  function validate(): boolean {
    const result = medicationFormSchema.safeParse(vals);
    if (result.success) { setErrors({}); return true; }
    setErrors(fieldErrors(result) as Partial<MedFormValues>);
    return false;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await firebaseService.submitRequest({
        patientId:   vals.patientId,
        submittedBy: user.uid,
        details: {
          type:          "medication",
          drugName:      vals.drugName,
          rxcui:         vals.rxcui,
          strength:      vals.strength || undefined,
          doseForm:      vals.doseForm || undefined,
          route:         vals.route || undefined,
          frequency:     vals.frequency || undefined,
          startDate:     vals.startDate || undefined,
          indication:    vals.indicationCode ? { code: vals.indicationCode, description: vals.indicationDesc } : undefined,
          quantity:      Number(vals.quantity),
          refills:       Number(vals.refills),
          pharmacy:      vals.pharmacy,
          justification: vals.justification || undefined,
        },
      }, user);
      toast.success("Medication request submitted");
      onDone();
    } catch {
      setSubmitError("Failed to submit request. Please try again.");
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn onClick={onBack} label="Change type" />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.accent, background: T.accentLight, padding: "3px 10px", borderRadius: 12 }}>
          Medication Refill
        </span>
      </div>

      <PatientSelect
        patients={patients}
        value={vals.patientId}
        onChange={(v) => set("patientId", v)}
        error={errors.patientId}
      />

      <DrugSearch
        value={vals.drugName}
        onSelect={(drug: Drug) => {
          setVals((v) => ({
            ...v,
            drugName: drug.name,
            rxcui: drug.rxcui,
            strength: drug.strength || "",
            doseForm: drug.doseForm || "",
            route: drug.route || "",
          }));
          setErrors((e) => ({ ...e, drugName: "" }));
          if (drug.strength || drug.doseForm || drug.route) {
            setAutoFilled(true);
            setTimeout(() => setAutoFilled(false), 2000);
          }
        }}
        label="Medication"
        required
        error={errors.drugName}
      />

      {/* Drug details row (always visible) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 14, border: `1px solid ${autoFilled ? T.accent + "60" : T.borderLight}`, borderRadius: T.radiusSm, transition: "border-color 0.3s" }}>
        <Input
          label="Strength"
          placeholder="e.g. 10 MG"
          value={vals.strength}
          onChange={(e) => set("strength", e.target.value)}
        />
        <Input
          label="Dose Form"
          placeholder="e.g. Tab"
          value={vals.doseForm}
          onChange={(e) => set("doseForm", e.target.value)}
        />
        <Input
          label="Route"
          placeholder="e.g. Oral"
          value={vals.route}
          onChange={(e) => set("route", e.target.value)}
        />
      </div>
      {autoFilled && (
        <span style={{
          fontSize: 10, color: T.accent, fontWeight: 500,
          marginTop: -12, display: "block",
          transition: "opacity 0.3s",
        }}>
          Auto-filled from RxNorm — values are editable
        </span>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Select
          label="Frequency"
          required
          value={vals.frequency}
          onChange={(e) => set("frequency", e.target.value)}
          error={errors.frequency}
        >
          <option value="">Select frequency…</option>
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Input
          label="Start Date"
          required
          type="date"
          value={vals.startDate}
          onChange={(e) => set("startDate", e.target.value)}
          error={errors.startDate}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Input
          label="Quantity"
          required
          type="number"
          min={1}
          value={vals.quantity}
          onChange={(e) => set("quantity", e.target.value)}
          error={errors.quantity}
        />
        <Input
          label="Refills"
          type="number"
          min={0}
          max={12}
          value={vals.refills}
          onChange={(e) => set("refills", e.target.value)}
        />
      </div>

      <Input
        label="Pharmacy"
        required
        placeholder="Pharmacy name and location…"
        value={vals.pharmacy}
        onChange={(e) => set("pharmacy", e.target.value)}
        error={errors.pharmacy}
      />

      <Icd10Search
        code={vals.indicationCode}
        description={vals.indicationDesc}
        onSelect={(code, desc) => {
          setVals((v) => ({ ...v, indicationCode: code, indicationDesc: desc }));
        }}
        label="Indication (ICD-10)"
        error=""
      />

      <Input
        as="textarea"
        label="Notes (optional)"
        rows={3}
        placeholder="Any additional notes for the pharmacist or admin…"
        value={vals.justification}
        onChange={(e) => set("justification", (e.target as HTMLTextAreaElement).value)}
      />

      {submitError && (
        <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{submitError}</span>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
        <Btn variant="primary" icon="check" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Request"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Multi-medication form ────────────────────────────────────────────────────

interface DrugRow {
  uid: string;
  drugName: string;
  rxcui: string;
  strength: string;
  doseForm: string;
  route: string;
  frequency: string;
  quantity: string;
  refills: string;
}

function MultiMedForm({
  patients,
  preselectedPatient,
  user,
  onDone,
  onBack,
}: {
  patients: Patient[];
  preselectedPatient: string;
  user: Staff;
  onDone: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [patientId, setPatientId] = useState(preselectedPatient);
  const [patientError, setPatientError] = useState("");
  const [rows, setRows] = useState<DrugRow[]>([
    { uid: "row-0", drugName: "", rxcui: "", strength: "", doseForm: "", route: "", frequency: "", quantity: "30", refills: "0" },
  ]);
  const [pharmacy, setPharmacy] = useState("");
  const [pharmacyError, setPharmacyError] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [startDateError, setStartDateError] = useState("");
  const [indicationCode, setIndicationCode] = useState("");
  const [indicationDesc, setIndicationDesc] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rowAutoFilled, setRowAutoFilled] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function addRow() {
    if (rows.length >= 10) return;
    setRows((r) => [...r, { uid: `row-${Date.now()}`, drugName: "", rxcui: "", strength: "", doseForm: "", route: "", frequency: "", quantity: "30", refills: "0" }]);
  }

  function removeRow(uid: string) {
    if (rows.length <= 1) return;
    setRows((r) => r.filter((x) => x.uid !== uid));
    setRowErrors((e) => { const next = { ...e }; delete next[uid]; return next; });
  }

  function updateRow(uid: string, field: keyof DrugRow, val: string) {
    setRows((r) => r.map((x) => (x.uid === uid ? { ...x, [field]: val } : x)));
    if (field === "drugName") setRowErrors((e) => ({ ...e, [uid]: "" }));
  }

  function validate(): boolean {
    let ok = true;

    // Validate top-level fields via Zod
    const topResult = multiMedicationFormSchema.safeParse({
      patientId,
      startDate,
      indicationCode: indicationCode || undefined,
      indicationDesc: indicationDesc || undefined,
      drugs: rows.map((r) => ({
        drugName: r.drugName, rxcui: r.rxcui, strength: r.strength || undefined,
        doseForm: r.doseForm || undefined, route: r.route || undefined,
        frequency: r.frequency, quantity: Number(r.quantity), refills: Number(r.refills),
      })),
      pharmacy,
    });
    const errs = topResult.success ? {} : fieldErrors(topResult);

    if (errs.patientId) { setPatientError(errs.patientId); ok = false; }
    else setPatientError("");
    if (errs.pharmacy) { setPharmacyError(errs.pharmacy); ok = false; }
    else setPharmacyError("");
    if (errs.startDate) { setStartDateError(errs.startDate); ok = false; }
    else setStartDateError("");

    // Per-row validation
    const re: Record<string, string> = {};
    rows.forEach((r, i) => {
      const rowResult = drugRowSchema.safeParse({
        drugName: r.drugName, rxcui: r.rxcui, strength: r.strength || undefined,
        doseForm: r.doseForm || undefined, route: r.route || undefined,
        frequency: r.frequency, quantity: Number(r.quantity), refills: Number(r.refills),
      });
      if (!rowResult.success) {
        const rowErrs = fieldErrors(rowResult);
        re[r.uid] = rowErrs.drugName || rowErrs.frequency || rowErrs.quantity || "Invalid entry.";
        ok = false;
      }
    });
    // Also pick up any Zod errors on individual drugs items
    rows.forEach((r, i) => {
      const drugErr = errs[`drugs.${i}.drugName`] || errs[`drugs.${i}.frequency`];
      if (drugErr && !re[r.uid]) { re[r.uid] = drugErr; ok = false; }
      else if (!r.frequency) { re[r.uid] = "Frequency is required."; ok = false; }
    });
    setRowErrors(re);
    return ok;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await firebaseService.submitRequest({
        patientId,
        submittedBy: user.uid,
        details: {
          type:  "multi_medication",
          startDate: startDate || undefined,
          indication: indicationCode ? { code: indicationCode, description: indicationDesc } : undefined,
          drugs: rows.map((r) => ({
            drugName:  r.drugName,
            rxcui:     r.rxcui,
            strength:  r.strength || undefined,
            doseForm:  r.doseForm || undefined,
            route:     r.route || undefined,
            frequency: r.frequency || undefined,
            quantity:  Number(r.quantity),
            refills:   Number(r.refills),
          })),
          pharmacy,
        },
      }, user);
      toast.success(`${rows.length} medication request${rows.length === 1 ? "" : "s"} submitted`);
      onDone();
    } catch {
      setSubmitError("Failed to submit request. Please try again.");
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  const inlineInputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 13,
    color: T.text,
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm,
    padding: "10px 8px",
    outline: "none",
    fontFamily: T.font,
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn onClick={onBack} label="Change type" />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.purple, background: T.purpleLight, padding: "3px 10px", borderRadius: 12 }}>
          Multi-Medication Batch
        </span>
      </div>

      <PatientSelect
        patients={patients}
        value={patientId}
        onChange={(v) => { setPatientId(v); setPatientError(""); }}
        error={patientError}
      />

      {/* Shared fields: Start Date + Indication */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Input
          label="Start Date"
          required
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setStartDateError(""); }}
          error={startDateError}
        />
        <div /> {/* spacer */}
      </div>

      <Icd10Search
        code={indicationCode}
        description={indicationDesc}
        onSelect={(code, desc) => { setIndicationCode(code); setIndicationDesc(desc); }}
        label="Indication (ICD-10)"
        error=""
      />

      {/* Drug cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.3 }}>
            Medications <span style={{ color: T.urgent }}>*</span>
          </label>
          <span style={{ fontSize: 12, color: T.textLight }}>{rows.length}/10</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.uid}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 14,
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              marginBottom: 10,
            }}
          >
            {/* Row 1: Drug search + remove button */}
            <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
              <div style={{ flex: 1 }}>
                <DrugSearch
                  value={row.drugName}
                  onSelect={(drug: Drug) => {
                    updateRow(row.uid, "drugName", drug.name);
                    updateRow(row.uid, "rxcui", drug.rxcui);
                    updateRow(row.uid, "strength", drug.strength || "");
                    updateRow(row.uid, "doseForm", drug.doseForm || "");
                    updateRow(row.uid, "route", drug.route || "");
                    if (drug.strength || drug.doseForm || drug.route) {
                      setRowAutoFilled((prev) => ({ ...prev, [row.uid]: true }));
                      setTimeout(() => setRowAutoFilled((prev) => ({ ...prev, [row.uid]: false })), 2000);
                    }
                  }}
                  placeholder="Search medication…"
                  error={rowErrors[row.uid]}
                />
              </div>
              <button
                onClick={() => removeRow(row.uid)}
                disabled={rows.length <= 1}
                title="Remove medication"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  marginTop: 6,
                  borderRadius: T.radiusSm,
                  background: "none",
                  border: "none",
                  cursor: rows.length <= 1 ? "not-allowed" : "pointer",
                  color: rows.length <= 1 ? T.textLight : T.urgent,
                  transition: "color 0.1s",
                }}
              >
                <Icon name="x" size={14} color={rows.length <= 1 ? T.textLight : T.urgent} />
              </button>
            </div>

            {/* Row 2: Drug detail fields (always visible) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "6px 8px", background: T.bgSub, borderRadius: T.radiusSm, border: `1px solid ${rowAutoFilled[row.uid] ? T.accent + "60" : "transparent"}`, transition: "border-color 0.3s" }}>
              <input
                placeholder="Strength"
                value={row.strength}
                onChange={(e) => updateRow(row.uid, "strength", e.target.value)}
                style={{ ...inlineInputStyle, fontSize: 12, padding: "6px 8px", background: T.bgSub, border: `1px solid ${T.borderLight}` }}
              />
              <input
                placeholder="Form"
                value={row.doseForm}
                onChange={(e) => updateRow(row.uid, "doseForm", e.target.value)}
                style={{ ...inlineInputStyle, fontSize: 12, padding: "6px 8px", background: T.bgSub, border: `1px solid ${T.borderLight}` }}
              />
              <input
                placeholder="Route"
                value={row.route}
                onChange={(e) => updateRow(row.uid, "route", e.target.value)}
                style={{ ...inlineInputStyle, fontSize: 12, padding: "6px 8px", background: T.bgSub, border: `1px solid ${T.borderLight}` }}
              />
            </div>
            {rowAutoFilled[row.uid] && (
              <span style={{
                fontSize: 10, color: T.accent, fontWeight: 500,
                marginTop: -4, display: "block",
                transition: "opacity 0.3s",
              }}>
                Auto-filled from RxNorm — values are editable
              </span>
            )}

            {/* Row 3: Frequency + Qty + Refills */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8 }}>
              <select
                value={row.frequency}
                onChange={(e) => updateRow(row.uid, "frequency", e.target.value)}
                style={{ ...inlineInputStyle, cursor: "pointer" }}
              >
                <option value="">Frequency…</option>
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => updateRow(row.uid, "quantity", e.target.value)}
                placeholder="Qty"
                style={inlineInputStyle}
              />
              <input
                type="number"
                min={0}
                max={12}
                value={row.refills}
                onChange={(e) => updateRow(row.uid, "refills", e.target.value)}
                placeholder="Refills"
                style={inlineInputStyle}
              />
            </div>
          </div>
        ))}

        {rows.length < 10 && (
          <button
            onClick={addRow}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 12px",
              marginTop: 2,
              background: "none",
              border: `1px dashed ${T.border}`,
              borderRadius: T.radiusSm,
              cursor: "pointer",
              fontFamily: T.font,
              fontSize: 13,
              fontWeight: 500,
              color: T.textSub,
              transition: "color 0.1s, border-color 0.1s",
              width: "100%",
            }}
          >
            <Icon name="plus" size={14} color={T.textSub} />
            Add medication
          </button>
        )}
      </div>

      <Input
        label="Pharmacy"
        required
        placeholder="Pharmacy name and location…"
        value={pharmacy}
        onChange={(e) => { setPharmacy(e.target.value); setPharmacyError(""); }}
        error={pharmacyError}
      />

      {submitError && (
        <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{submitError}</span>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
        <Btn variant="primary" icon="check" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Request"}
        </Btn>
      </div>
    </div>
  );
}

// ─── New Request View (orchestrator) ──────────────────────────────────────────

interface NewRequestViewProps {
  user: Staff;
  patients: Patient[];
  preselectedPatient: string;
  onDone: () => void;
}

type FormStep = "select" | "dme" | "medication" | "multi_medication" | "confirm";

export default function NewRequestView({
  user,
  patients,
  preselectedPatient,
  onDone,
}: NewRequestViewProps) {
  const [step, setStep] = useState<FormStep>("select");

  function handleType(t: RequestType) {
    setStep(t);
  }

  function handleDone() {
    setStep("confirm");
  }

  function handleBack() {
    setStep("select");
  }

  if (step === "confirm") {
    return (
      <ConfirmationScreen
        onSubmitAnother={() => setStep("select")}
        onViewRequests={onDone}
      />
    );
  }

  if (step === "dme") {
    return (
      <DmeForm
        patients={patients}
        preselectedPatient={preselectedPatient}
        user={user}
        onDone={handleDone}
        onBack={handleBack}
      />
    );
  }

  if (step === "medication") {
    return (
      <MedicationForm
        patients={patients}
        preselectedPatient={preselectedPatient}
        user={user}
        onDone={handleDone}
        onBack={handleBack}
      />
    );
  }

  if (step === "multi_medication") {
    return (
      <MultiMedForm
        patients={patients}
        preselectedPatient={preselectedPatient}
        user={user}
        onDone={handleDone}
        onBack={handleBack}
      />
    );
  }

  return <TypeSelector onSelect={handleType} />;
}
