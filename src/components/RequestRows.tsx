import { useState } from "react";
import { T } from "../tokens";
import { reqTitle } from "../utils/statusHelpers";
import { timeAgo } from "../utils/formatting";
import TypeBadge from "./TypeBadge";
import StatusPill from "./StatusPill";
import EmptyState from "./EmptyState";
import type { Request, Patient, Staff } from "../types";

interface RequestRowsProps {
  requests: Request[];
  patients: Patient[];
  staff: Staff[];
  onSelect: (req: Request) => void;
  limit?: number;
  emptyTitle?: string;
  emptySubtitle?: string;
}

function RequestRow({
  req,
  patient,
  onSelect,
}: {
  req: Request;
  patient: Patient | undefined;
  onSelect: (req: Request) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(req)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 16px",
        background: hovered ? T.bgHover : "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
        borderBottom: `1px solid ${T.borderLight}`,
      }}
    >
      {/* Type badge */}
      <div style={{ flexShrink: 0 }}>
        <TypeBadge type={req.details.type} short />
      </div>

      {/* Title + patient */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: T.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {reqTitle(req)}
        </p>
        {patient && (
          <p style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
            {patient.name} · {patient.mrn}
          </p>
        )}
      </div>

      {/* Status + time */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <StatusPill status={req.status} />
        <span style={{ fontSize: 11, color: T.textLight }}>{timeAgo(req.createdAt)}</span>
      </div>
    </div>
  );
}

export default function RequestRows({
  requests,
  patients,
  staff: _staff,
  onSelect,
  limit,
  emptyTitle = "No requests found",
  emptySubtitle = "Requests will appear here once submitted.",
}: RequestRowsProps) {
  const displayed = limit ? requests.slice(0, limit) : requests;

  if (displayed.length === 0) {
    return (
      <EmptyState
        icon="requests"
        title={emptyTitle}
        subtitle={emptySubtitle}
      />
    );
  }

  return (
    <div style={{ borderRadius: T.radius, overflow: "hidden" }}>
      {displayed.map((req) => {
        const patient = patients.find((p) => p.id === req.patientId);
        return (
          <RequestRow key={req.id} req={req} patient={patient} onSelect={onSelect} />
        );
      })}
    </div>
  );
}
