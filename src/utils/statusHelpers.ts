import { T } from "../tokens";
import type { RequestStatus, RequestType, UserRole, Request } from "../types";

// ─── Status ───────────────────────────────────────────────────────────────────

export interface StatusStyle {
  color: string;
  bg: string;
  dot: string;
  label: string;
}

export function statusColor(status: RequestStatus): StatusStyle {
  switch (status) {
    case "pending":
      return { color: T.warn,   bg: T.warnLight,   dot: T.warn,   label: "Pending Review" };
    case "approved":
      return { color: T.accent, bg: T.accentLight,  dot: T.accent, label: "Approved" };
    case "denied":
      return { color: T.urgent, bg: T.urgentLight,  dot: T.urgent, label: "Denied" };
    case "rmi":
      return { color: T.info,   bg: T.infoLight,    dot: T.info,   label: "Needs Info" };
  }
}

// ─── Request type ─────────────────────────────────────────────────────────────

export interface TypeStyle {
  color: string;
  bg: string;
  icon: string;
  label: string;
  shortLabel: string;
}

export function typeInfo(type: RequestType): TypeStyle {
  switch (type) {
    case "dme":
      return { color: T.info,   bg: T.infoLight,   icon: "dme",   label: "DME Request",              shortLabel: "DME"        };
    case "medication":
      return { color: T.accent, bg: T.accentLight,  icon: "pill",  label: "Medication Refill",        shortLabel: "Medication" };
    case "multi_medication":
      return { color: T.purple, bg: T.purpleLight,  icon: "pills", label: "Multi-Medication Batch",   shortLabel: "Multi-Med"  };
  }
}

// ─── Request title ────────────────────────────────────────────────────────────

export function reqTitle(req: Request): string {
  const { details } = req;
  switch (details.type) {
    case "dme":
      return details.equipmentName;
    case "medication":
      return details.drugName;
    case "multi_medication":
      return details.drugs.length === 1
        ? details.drugs[0].drugName
        : `${details.drugs.length} Medications`;
  }
}

// ─── Role label ───────────────────────────────────────────────────────────────

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":        return "Admin";
    case "nurse":        return "Nurse";
    case "homemaker":    return "Homemaker";
    case "office_staff": return "Office Staff";
  }
}
