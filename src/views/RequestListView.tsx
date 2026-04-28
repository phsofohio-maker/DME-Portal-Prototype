import { useState } from "react";
import { T } from "../tokens";
import RequestRows from "../components/RequestRows";
import Btn from "../components/Btn";
import type { Staff, Request, Patient, RequestStatus, RequestType } from "../types";

type StatusFilter = "all" | RequestStatus;
type TypeFilter   = "all" | RequestType;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all",      label: "All"          },
  { id: "pending",  label: "Pending"      },
  { id: "approved", label: "Approved"     },
  { id: "rmi",      label: "Needs Info"   },
  { id: "denied",   label: "Denied"       },
  { id: "filled",   label: "Filled"       },
];

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all",              label: "All Types"  },
  { id: "dme",              label: "DME"        },
  { id: "medication",       label: "Medication" },
  { id: "multi_medication", label: "Multi-Med"  },
];

function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? T.accent : hovered ? T.text : T.textSub,
        background: active ? T.accentLight : hovered ? T.bgHover : T.bgCard,
        border: `1px solid ${active ? T.accent + "50" : T.border}`,
        cursor: "pointer",
        transition: "all 0.12s",
        fontFamily: T.font,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: active ? T.accent : T.textLight,
            background: active ? T.accent + "18" : T.bgSub,
            padding: "1px 6px",
            borderRadius: 8,
            minWidth: 20,
            textAlign: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface RequestListViewProps {
  user: Staff;
  requests: Request[];
  patients: Patient[];
  staff: Staff[];
  onSelectRequest: (req: Request) => void;
  onNewRequest: () => void;
}

export default function RequestListView({
  user,
  requests,
  patients,
  staff,
  onSelectRequest,
  onNewRequest,
}: RequestListViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("all");

  const base = user.role === "admin"
    ? requests
    : requests.filter((r) => r.submittedBy === user.uid);

  const filtered = base.filter((r) => {
    const statusOk = statusFilter === "all" || r.status === statusFilter;
    const typeOk   = typeFilter   === "all" || r.details.type === typeFilter;
    return statusOk && typeOk;
  });

  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 860 }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, color: T.textSub }}>
          {sorted.length} request{sorted.length !== 1 ? "s" : ""}
          {statusFilter !== "all" || typeFilter !== "all" ? " (filtered)" : ""}
        </p>
        <Btn variant="primary" icon="plus" size="sm" onClick={onNewRequest}>
          New Request
        </Btn>
      </div>

      {/* Status filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => {
          const count = f.id === "all"
            ? base.length
            : base.filter((r) => r.status === f.id).length;
          return (
            <FilterPill
              key={f.id}
              label={f.label}
              active={statusFilter === f.id}
              count={count}
              onClick={() => setStatusFilter(f.id)}
            />
          );
        })}
      </div>

      {/* Type filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TYPE_FILTERS.map((f) => {
          const count = f.id === "all"
            ? base.length
            : base.filter((r) => r.details.type === f.id).length;
          return (
            <FilterPill
              key={f.id}
              label={f.label}
              active={typeFilter === f.id}
              count={count}
              onClick={() => setTypeFilter(f.id)}
            />
          );
        })}
      </div>

      {/* Request list */}
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.borderLight}`,
          borderRadius: T.radius,
          boxShadow: T.shadow,
          overflow: "hidden",
        }}
      >
        <RequestRows
          requests={sorted}
          patients={patients}
          staff={staff}
          onSelect={onSelectRequest}
          emptyTitle={
            statusFilter !== "all" || typeFilter !== "all"
              ? "No matching requests"
              : "No requests yet"
          }
          emptySubtitle={
            statusFilter !== "all" || typeFilter !== "all"
              ? "Try adjusting the filters above."
              : "Submit a new request to get started."
          }
        />
      </div>
    </div>
  );
}
