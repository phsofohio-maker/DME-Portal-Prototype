import { useState } from "react";
import { T } from "../tokens";
import Avatar from "../components/Avatar";
import { getInitials } from "../utils/formatting";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Input from "../components/Input";
import Icon from "../components/Icon";
import { roleLabel } from "../utils/statusHelpers";
import { firebaseService } from "../services/firebaseService";
import { profileUpdateSchema } from "../lib/schemas";
import type { Staff } from "../types";

const ROLE_COLORS: Record<string, string> = {
  admin:        T.accent,
  nurse:        T.info,
  homemaker:    T.warn,
  office_staff: T.purple,
};

interface SettingsViewProps {
  user: Staff;
  onUpdateUser: (updates: Partial<Pick<Staff, "displayName" | "notificationPrefs">>) => void;
}

export default function SettingsView({ user, onUpdateUser }: SettingsViewProps) {
  const avatarColor = ROLE_COLORS[user.role] ?? T.accent;
  const roleColor   = avatarColor;

  // Form state (non-functional — display only)
  const [displayName,   setDisplayName]   = useState(user.displayName);
  const [email,         setEmail]         = useState(user.email);
  const [currentPw,     setCurrentPw]     = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [saved,         setSaved]         = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState("");

  async function handleSave() {
    const parsed = profileUpdateSchema.safeParse({ displayName });
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Validation failed.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await firebaseService.updateStaff(user.uid, { displayName });
      onUpdateUser({ displayName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>

      {/* Profile header card */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar initials={getInitials(user.displayName)} color={avatarColor} size={64} />
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontFamily: T.fontDisplay,
                fontSize: 22,
                fontWeight: 400,
                color: T.text,
                marginBottom: 4,
              }}
            >
              {user.displayName}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: T.textSub }}>{user.email}</span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: roleColor + "18",
                  color: roleColor,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {roleLabel(user.role)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Profile settings */}
      <Card>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.textSub,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            marginBottom: 18,
          }}
        >
          Profile Settings
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
            placeholder="Your full name"
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
            placeholder="your@parrish.health"
          />

          <div
            style={{
              paddingTop: 16,
              borderTop: `1px solid ${T.borderLight}`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Change Password</p>
            <Input
              label="Current Password"
              type="password"
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); setSaved(false); }}
              placeholder="Enter current password"
            />
            <Input
              label="New Password"
              type="password"
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); setSaved(false); }}
              placeholder="Enter new password"
              hint="Minimum 8 characters"
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
            </Btn>
            {saved && !saving && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="check" size={15} color={T.accent} />
                <span style={{ fontSize: 13, color: T.accent, fontWeight: 500 }}>Changes saved</span>
              </div>
            )}
            {saveError && (
              <span style={{ fontSize: 12, color: T.urgent, fontWeight: 500 }}>{saveError}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Notifications */}
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
          Notifications
        </h3>
        <SoundToggle user={user} onUpdateUser={onUpdateUser} />
      </Card>

      {/* Security */}
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
          Security
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SecurityRow
            icon="check"
            iconColor={T.accent}
            iconBg={T.accentLight}
            label="Two-Factor Authentication"
            description="Add an extra layer of security to your account."
            badge={null}
            action={<Btn variant="secondary" size="sm">Enable</Btn>}
            last={false}
          />
          <SecurityRow
            icon="clock"
            iconColor={T.info}
            iconBg={T.infoLight}
            label="Session Timeout"
            description="Automatically sign out after a period of inactivity."
            badge="Active"
            badgeColor={T.accent}
            action={<Btn variant="secondary" size="sm">Configure</Btn>}
            last={true}
          />
        </div>
      </Card>

      {/* Prototype notice */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: T.bgSub,
          borderRadius: T.radiusSm,
          border: `1px solid ${T.borderLight}`,
        }}
      >
        <Icon name="alert" size={15} color={T.textLight} />
        <p style={{ fontSize: 12, color: T.textLight, lineHeight: 1.5 }}>
          Password and email changes are not yet functional. Security features are coming in a future update.
        </p>
      </div>
    </div>
  );
}

// ─── Security row ─────────────────────────────────────────────────────────────

function SecurityRow({
  icon,
  iconColor,
  iconBg,
  label,
  description,
  badge,
  badgeColor,
  action,
  last,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  iconColor: string;
  iconBg: string;
  label: string;
  description: string;
  badge: string | null;
  badgeColor?: string;
  action: React.ReactNode;
  last: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 0",
        borderBottom: last ? "none" : `1px solid ${T.borderLight}`,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={17} color={iconColor} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{label}</p>
          {badge && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: badgeColor ?? T.accent,
                background: (badgeColor ?? T.accent) + "18",
                padding: "1px 7px",
                borderRadius: 8,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: T.textSub }}>{description}</p>
      </div>

      <div style={{ flexShrink: 0 }}>{action}</div>
    </div>
  );
}

// ─── Sound toggle ─────────────────────────────────────────────────────────────

function SoundToggle({
  user,
  onUpdateUser,
}: {
  user: Staff;
  onUpdateUser: (updates: Partial<Pick<Staff, "displayName" | "notificationPrefs">>) => void;
}) {
  const enabled = user.notificationPrefs?.soundEnabled !== false;
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const nextPrefs = { ...user.notificationPrefs, soundEnabled: !enabled };
    setSaving(true);
    try {
      await firebaseService.updateStaff(user.uid, { notificationPrefs: nextPrefs });
      onUpdateUser({ notificationPrefs: nextPrefs });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0" }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          background: T.infoLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="bell" size={17} color={T.info} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>Notification sound</p>
        <p style={{ fontSize: 12, color: T.textSub }}>
          Play a short tone when a new in-app notification arrives.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        aria-pressed={enabled}
        aria-label={`Notification sound ${enabled ? "on" : "off"}`}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          padding: 0,
          background: enabled ? T.accent : T.border,
          cursor: saving ? "default" : "pointer",
          position: "relative",
          transition: "background 150ms ease",
          flexShrink: 0,
          opacity: saving ? 0.6 : 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 150ms ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
      </button>
    </div>
  );
}
