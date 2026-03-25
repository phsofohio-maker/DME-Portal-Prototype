import { T } from "../tokens";
import Card from "../components/Card";
import RequestRows from "../components/RequestRows";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import type { Staff, Request, Patient, ViewId } from "../types";

interface DashboardViewProps {
  user: Staff;
  requests: Request[];
  patients: Patient[];
  staff: Staff[];
  onSelectRequest: (req: Request) => void;
  onNavigate: (v: ViewId) => void;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  icon: Parameters<typeof Icon>[0]["name"];
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <Card style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: T.textSub,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: color + "18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={16} color={color} />
        </div>
      </div>
      <p
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: T.text,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
    </Card>
  );
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

export default function DashboardView({
  user,
  requests,
  patients,
  staff,
  onSelectRequest,
  onNavigate,
}: DashboardViewProps) {
  const firstName = user.displayName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const isAdmin = user.role === "admin";
  const myRequests = isAdmin ? requests : requests.filter((r) => r.submittedBy === user.uid);
  const myPatientIds = patients
    .filter((p) => p.primaryNurse === user.uid)
    .map((p) => p.id);

  // Stats
  const stats: StatCardProps[] = isAdmin
    ? [
        { label: "Pending Review",  value: requests.filter((r) => r.status === "pending").length,  color: T.warn,   icon: "clock"    },
        { label: "Needs Info",      value: requests.filter((r) => r.status === "rmi").length,       color: T.info,   icon: "requests" },
        { label: "Approved",        value: requests.filter((r) => r.status === "approved").length,  color: T.accent, icon: "check"    },
        { label: "Active Patients", value: patients.filter((p) => p.status === "active").length,   color: T.purple, icon: "patients" },
      ]
    : [
        { label: "My Pending",   value: myRequests.filter((r) => r.status === "pending").length,  color: T.warn,   icon: "clock"    },
        { label: "Needs Info",   value: myRequests.filter((r) => r.status === "rmi").length,       color: T.info,   icon: "requests" },
        { label: "Approved",     value: myRequests.filter((r) => r.status === "approved").length,  color: T.accent, icon: "check"    },
        { label: "My Patients",  value: myPatientIds.length,                                       color: T.purple, icon: "patients" },
      ];

  // Recent requests: top 5, most recent first
  const recent = [...myRequests]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>

      {/* Greeting */}
      <div>
        <h2
          style={{
            fontFamily: T.fontDisplay,
            fontSize: 28,
            fontWeight: 400,
            color: T.text,
            marginBottom: 4,
          }}
        >
          {greeting}, {firstName}.
        </h2>
        <p style={{ fontSize: 14, color: T.textSub }}>
          {isAdmin
            ? `You have ${requests.filter((r) => r.status === "pending").length} request${requests.filter((r) => r.status === "pending").length !== 1 ? "s" : ""} awaiting review.`
            : `You have ${myRequests.filter((r) => r.status === "pending" || r.status === "rmi").length} active request${myRequests.filter((r) => r.status === "pending" || r.status === "rmi").length !== 1 ? "s" : ""} in progress.`}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 14 }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Recent requests */}
      <Card padding={0}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${T.borderLight}`,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Recent Requests</h3>
          <Btn
            variant="ghost"
            size="sm"
            icon="chevron-right"
            iconRight
            onClick={() => onNavigate("requests")}
          >
            View all
          </Btn>
        </div>
        <RequestRows
          requests={recent}
          patients={patients}
          staff={staff}
          onSelect={onSelectRequest}
          emptyTitle="No requests yet"
          emptySubtitle="Requests you submit will appear here."
        />
      </Card>
    </div>
  );
}
