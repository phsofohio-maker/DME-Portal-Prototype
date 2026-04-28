import { useEffect, useState } from "react";
import { T } from "../tokens";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Select from "../components/Select";
import Icon from "../components/Icon";
import EmptyState from "../components/EmptyState";
import { firebaseService } from "../services/firebaseService";
import { fmtDateTime } from "../utils/formatting";
import type { AuditAction, AuditLogEntry } from "../types";

const ACTION_LABELS: Record<string, string> = {
  "auth.login":        "Sign-in",
  "auth.logout":       "Sign-out",
  "request.created":   "Request created",
  "request.updated":   "Request updated",
  "request.approved":  "Request approved",
  "request.denied":    "Request denied",
  "request.rmi":       "More info requested",
  "request.filled":    "Request filled",
  "staff.invited":     "Staff invited",
  "staff.suspended":   "Staff suspended",
};

const FILTER_OPTIONS: Array<{ value: "" | AuditAction; label: string }> = [
  { value: "",                  label: "All actions" },
  { value: "request.created",   label: "Request created" },
  { value: "request.approved",  label: "Request approved" },
  { value: "request.denied",    label: "Request denied" },
  { value: "request.rmi",       label: "More info requested" },
  { value: "request.filled",    label: "Request filled" },
  { value: "auth.login",        label: "Sign-in" },
  { value: "auth.logout",       label: "Sign-out" },
  { value: "staff.invited",     label: "Staff invited" },
  { value: "staff.suspended",   label: "Staff suspended" },
];

const PAGE_SIZE = 50;

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function summarizeMetadata(meta: Record<string, unknown> | undefined): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (meta.requestType) parts.push(`type: ${String(meta.requestType)}`);
  if (meta.requestId)   parts.push(`req: ${String(meta.requestId).slice(0, 8)}`);
  if (meta.previousStatus) parts.push(`from: ${String(meta.previousStatus)}`);
  return parts.join(" · ");
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function exportCsv(entries: AuditLogEntry[]) {
  const header = ["Timestamp (ISO)", "Action", "Actor email", "Actor ID", "Metadata"];
  const rows = entries.map((e) => [
    new Date(e.timestamp).toISOString(),
    e.action,
    e.actorEmail,
    e.actorId,
    JSON.stringify(e.metadata ?? {}),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AuditTrailView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | AuditAction>("");
  const [error, setError]   = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await firebaseService.getAuditLog(PAGE_SIZE, undefined, filter || undefined);
        if (!cancelled) setEntries(res.entries);
      } catch {
        if (!cancelled) setError("Failed to load audit log.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 26, color: T.text, marginRight: "auto" }}>
          Audit Trail
        </h1>
        <div style={{ minWidth: 220 }}>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "" | AuditAction)}
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
        <Btn
          variant="secondary"
          icon="download"
          onClick={() => exportCsv(entries)}
          disabled={entries.length === 0}
        >
          Export CSV
        </Btn>
      </div>

      <Card>
        {loading ? (
          <p style={{ fontSize: 13, color: T.textSub, padding: 24, textAlign: "center" }}>Loading…</p>
        ) : error ? (
          <p style={{ fontSize: 13, color: T.urgent, padding: 24, textAlign: "center" }}>{error}</p>
        ) : entries.length === 0 ? (
          <EmptyState
            icon="file"
            title="No audit entries"
            subtitle={filter ? "Try a different filter." : "Activity will appear here as users sign in and process requests."}
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <Th>Timestamp</Th>
                  <Th>Action</Th>
                  <Th>Actor</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <Td>
                      <span style={{ color: T.textSub, fontVariantNumeric: "tabular-nums" }}>
                        {fmtDateTime(e.timestamp)}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ fontWeight: 600, color: T.text }}>{actionLabel(e.action)}</span>
                    </Td>
                    <Td>
                      <span style={{ color: T.textSub }}>{e.actorEmail || e.actorId || "—"}</span>
                    </Td>
                    <Td>
                      <span style={{ color: T.textLight, fontSize: 12 }}>
                        {summarizeMetadata(e.metadata) || "—"}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p style={{ fontSize: 11, color: T.textLight, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="lock" size={12} color={T.textLight} />
        Audit records are append-only and retained per HIPAA requirements (no hard deletes).
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: "left",
      padding: "10px 12px",
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: T.textSub,
    }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{children}</td>;
}
