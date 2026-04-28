import { useState } from "react";
import { T } from "../tokens";
import Icon from "./Icon";
import { roleLabel } from "../utils/statusHelpers";
import { getInitials } from "../utils/formatting";
import type { Staff, Request, ViewId } from "../types";

const ROLE_COLORS: Record<string, string> = {
  admin:        T.accent,
  nurse:        T.secondary,
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

const PRIMARY_NAV: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",   icon: "dashboard" },
  { id: "patients",    label: "Patients",    icon: "patients"  },
  { id: "requests",    label: "Requests",    icon: "requests", showBadge: true },
  { id: "new-request", label: "New Request", icon: "plus"      },
  { id: "messages",    label: "Messages",    icon: "messages"  },
];

const ADMIN_NAV: NavItem[] = [
  { id: "team",  label: "Team",        icon: "team", adminOnly: true },
  { id: "audit", label: "Audit Trail", icon: "file", adminOnly: true },
];

const ACCOUNT_NAV: NavItem[] = [
  { id: "help",     label: "Help",    icon: "help"     },
  { id: "settings", label: "Profile", icon: "settings" },
];

export default function Sidebar({
  user,
  view,
  onNavigate,
  requests,
  unreadMessageCount,
}: {
  user: Staff;
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  requests: Request[];
  unreadMessageCount: number;
}) {
  const pendingCount =
    user.role === "admin"
      ? requests.filter((r) => r.status === "pending").length
      : requests.filter((r) => r.submittedBy === user.uid && r.status === "pending").length;

  // Detail views highlight their parent
  const activeId: ViewId =
    view === "patient-detail" ? "patients" :
    view === "request-detail" ? "requests" :
    view;

  const badgeFor = (id: ViewId) =>
    id === "requests" ? pendingCount :
    id === "messages" ? unreadMessageCount :
    0;

  const avatarColor = ROLE_COLORS[user.role] ?? T.accent;

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: T.bgCard,
        borderRight: `1px solid ${T.borderLight}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: T.font,
      }}
    >
      {/* Brand block — logo sits on white so native brand colors read clearly */}
      <div
        style={{
          padding: "22px 20px 18px",
          borderBottom: `1px solid ${T.borderLight}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <img
          src="/images/Halo_O_SymbolEPS_.svg"
          alt=""
          aria-hidden
          style={{ width: 32, height: 32, flexShrink: 0, display: "block" }}
        />
        <img
          src="/images/HALO_DMEEPS_.svg"
          alt="Parrish HALO DME"
          style={{ width: 150, height: "auto", display: "block" }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            active={activeId === item.id}
            badge={badgeFor(item.id)}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        {user.role === "admin" && (
          <>
            <SectionLabel>Management</SectionLabel>
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={activeId === item.id}
                badge={badgeFor(item.id)}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </>
        )}

        <SectionLabel>Account</SectionLabel>
        {ACCOUNT_NAV.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            active={activeId === item.id}
            badge={badgeFor(item.id)}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* User card */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: `1px solid ${T.borderLight}`,
          background: T.bgSub,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: T.radiusFull,
            background: avatarColor + "1F",
            color: avatarColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getInitials(user.displayName)}
        </div>
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
          <p style={{ fontSize: 11, color: T.textLight, marginTop: 1 }}>{roleLabel(user.role)}</p>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: T.textLight,
        padding: "16px 20px 6px",
      }}
    >
      {children}
    </div>
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

  const bg =
    active ? T.accentLight :
    hovered ? T.bgHover :
    "transparent";
  const color =
    active ? T.accentDark :
    hovered ? T.text :
    T.textSub;
  const iconColor =
    active ? T.accent :
    hovered ? T.text :
    T.textLight;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "10px 20px",
        background: bg,
        border: "none",
        borderLeft: `3px solid ${active ? T.accent : "transparent"}`,
        cursor: "pointer",
        fontFamily: T.font,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        color,
        textAlign: "left",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <Icon name={item.icon} size={18} color={iconColor} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge > 0 && (
        <span
          style={{
            background: T.accent,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            minWidth: 20,
            height: 20,
            borderRadius: T.radiusFull,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6px",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
