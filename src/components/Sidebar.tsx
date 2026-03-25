import { useState } from "react";
import { T } from "../tokens";
import Icon from "./Icon";
import Avatar from "./Avatar";
import Badge from "./Badge";
import { roleLabel } from "../utils/statusHelpers";
import { getInitials } from "../utils/formatting";
import type { Staff, Request, ViewId } from "../types";

const ROLE_COLORS: Record<string, string> = {
  admin:        T.accent,
  nurse:        T.info,
  homemaker:    T.warn,
  office_staff: T.purple,
};

interface NavItem {
  id: ViewId;
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  adminOnly?: boolean;
  showBadge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",   icon: "dashboard"  },
  { id: "patients",    label: "Patients",    icon: "patients"   },
  { id: "requests",    label: "Requests",    icon: "requests",  showBadge: true },
  { id: "new-request", label: "New Request", icon: "plus"       },
  { id: "messages",    label: "Messages",    icon: "messages"   },
  { id: "team",        label: "Team",        icon: "team",      adminOnly: true },
  { id: "help",        label: "Help",        icon: "help"       },
  { id: "settings",    label: "Profile",     icon: "settings"   },
];

interface SidebarProps {
  user: Staff;
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  requests: Request[];
  unreadMessageCount: number;
}

export default function Sidebar({ user, view, onNavigate, requests, unreadMessageCount }: SidebarProps) {
  const pendingCount =
    user.role === "admin"
      ? requests.filter((r) => r.status === "pending").length
      : requests.filter((r) => r.submittedBy === user.uid && r.status === "pending").length;

  const unreadMsgCount = unreadMessageCount;

  const avatarColor = ROLE_COLORS[user.role] ?? T.accent;

  // Determine active nav — detail views should highlight their parent
  const activeId: ViewId =
    view === "patient-detail" ? "patients" :
    view === "request-detail" ? "requests" :
    view;

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: T.bgCard,
        borderRight: `1px solid ${T.borderLight}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: `1px solid ${T.borderLight}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: T.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div>
          <p
            style={{
              fontFamily: T.fontDisplay,
              fontSize: 15,
              fontWeight: 400,
              color: T.text,
              lineHeight: 1.2,
            }}
          >
            Parrish Health
          </p>
          <p style={{ fontSize: 11, color: T.textLight, marginTop: 1 }}>DME Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "admin").map((item) => {
          const badge =
            item.id === "requests" ? pendingCount :
            item.id === "messages" ? unreadMsgCount :
            0;
          return (
            <NavLink
              key={item.id}
              item={item}
              active={activeId === item.id}
              badge={badge}
              onClick={() => onNavigate(item.id)}
            />
          );
        })}
      </nav>

      {/* User profile */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: `1px solid ${T.borderLight}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Avatar initials={getInitials(user.displayName)} color={avatarColor} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user.displayName}
          </p>
          <p style={{ fontSize: 11, color: T.textSub, marginTop: 1 }}>{roleLabel(user.role)}</p>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const bg = active ? T.accentLight : hovered ? T.bgHover : "transparent";
  const color = active ? T.accent : hovered ? T.text : T.textSub;
  const weight = active ? 600 : 500;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "8px 10px",
        borderRadius: T.radiusSm,
        background: bg,
        border: "none",
        cursor: "pointer",
        fontFamily: T.font,
        fontSize: 13,
        fontWeight: weight,
        color,
        textAlign: "left",
        transition: "background 0.1s, color 0.1s",
        marginBottom: 2,
      }}
    >
      <Icon name={item.icon} size={16} color={color} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge > 0 && <Badge count={badge} />}
    </button>
  );
}
