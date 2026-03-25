import { useEffect, useRef, useState } from "react";
import { T } from "../tokens";
import Icon from "./Icon";
import Avatar from "./Avatar";
import Badge from "./Badge";
import { timeAgo, getInitials } from "../utils/formatting";
import type { Staff, Patient, Request, AppNotification, ViewId } from "../types";

const ROLE_COLORS: Record<string, string> = {
  admin:        T.accent,
  nurse:        T.info,
  homemaker:    T.warn,
  office_staff: T.purple,
};

const VIEW_META: Record<ViewId, { title: string; subtitle?: string }> = {
  dashboard:       { title: "Dashboard"    },
  patients:        { title: "Patients",      subtitle: "Patient Registry"   },
  "patient-detail":{ title: "",             subtitle: "Patient Profile"     },
  requests:        { title: "Requests",      subtitle: "All Requests"        },
  "request-detail":{ title: "",             subtitle: "Request Detail"      },
  "new-request":   { title: "New Request",  subtitle: "Submit a request"    },
  messages:        { title: "Messages",     subtitle: "Messaging Portal"    },
  team:            { title: "Team",         subtitle: "Team Management"     },
  help:            { title: "Help Center",  subtitle: "FAQ & Support"       },
  settings:        { title: "Settings",     subtitle: "Account Settings"    },
};

interface TopBarProps {
  user: Staff;
  view: ViewId;
  selectedPatient: Patient | null;
  selectedRequest: Request | null;
  notifications: AppNotification[];
  showNotifs: boolean;
  onToggleNotifs: () => void;
  onCloseNotifs: () => void;
  onLogout: () => void;
}

export default function TopBar({
  user,
  view,
  selectedPatient,
  selectedRequest,
  notifications,
  showNotifs,
  onToggleNotifs,
  onCloseNotifs,
  onLogout,
}: TopBarProps) {
  const userNotifs = notifications.filter((n) => n.recipientId === user.uid);
  const unreadCount = userNotifs.filter((n) => !n.read).length;

  const meta = VIEW_META[view];
  const title =
    view === "patient-detail" && selectedPatient ? selectedPatient.name :
    view === "request-detail" && selectedRequest ? `Request #${selectedRequest.id.toUpperCase()}` :
    meta.title;
  const subtitle =
    view === "dashboard" ? greeting(user.displayName.split(" ")[0]) :
    meta.subtitle;

  const bellRef = useRef<HTMLDivElement>(null);

  // Close notif panel on outside click
  useEffect(() => {
    if (!showNotifs) return;
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        onCloseNotifs();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifs, onCloseNotifs]);

  const avatarColor = ROLE_COLORS[user.role] ?? T.accent;

  return (
    <header
      style={{
        height: 64,
        background: T.bgCard,
        borderBottom: `1px solid ${T.borderLight}`,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Title area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: T.text,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 12, color: T.textSub, marginTop: 1 }}>{subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Notification bell */}
        <div ref={bellRef} style={{ position: "relative" }}>
          <BellBtn unread={unreadCount} onClick={onToggleNotifs} active={showNotifs} />
          {showNotifs && (
            <NotifsDropdown
              notifs={userNotifs}
              onClose={onCloseNotifs}
            />
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: T.borderLight }} />

        {/* User avatar */}
        <Avatar initials={getInitials(user.displayName)} color={avatarColor} size={32} />

        {/* Logout */}
        <LogoutBtn onClick={onLogout} />
      </div>
    </header>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BellBtn({ unread, onClick, active }: { unread: number; onClick: () => void; active: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: T.radiusSm,
        background: active ? T.accentLight : hovered ? T.bgHover : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 0.12s",
      }}
    >
      <Icon name="bell" size={18} color={active ? T.accent : hovered ? T.text : T.textSub} />
      {unread > 0 && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 16,
            height: 16,
            padding: "0 3px",
            borderRadius: 8,
            background: T.urgent,
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

function LogoutBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: T.radiusSm,
        background: hovered ? T.urgentLight : "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: T.font,
        fontSize: 12,
        fontWeight: 500,
        color: hovered ? T.urgent : T.textSub,
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <Icon name="logout" size={14} color={hovered ? T.urgent : T.textSub} />
      Logout
    </button>
  );
}

function NotifsDropdown({
  notifs,
  onClose,
}: {
  notifs: AppNotification[];
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 340,
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        boxShadow: T.shadowLg,
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: `1px solid ${T.borderLight}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Notifications</span>
        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: T.textSub,
          }}
        >
          <Icon name="x" size={14} color={T.textSub} />
        </button>
      </div>

      {/* List */}
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {notifs.length === 0 ? (
          <p style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.textLight }}>
            No notifications
          </p>
        ) : (
          notifs.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 16px",
                borderBottom: `1px solid ${T.borderLight}`,
                background: n.read ? "transparent" : T.accentLight + "60",
              }}
            >
              {/* Unread dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: n.read ? "transparent" : T.accent,
                  flexShrink: 0,
                  marginTop: 5,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{n.title}</p>
                <p
                  style={{
                    fontSize: 12,
                    color: T.textSub,
                    marginTop: 2,
                    lineHeight: 1.45,
                  }}
                >
                  {n.body}
                </p>
                <p style={{ fontSize: 11, color: T.textLight, marginTop: 4 }}>
                  {timeAgo(n.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Greeting helper ──────────────────────────────────────────────────────────

function greeting(firstName: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${firstName}`;
}
