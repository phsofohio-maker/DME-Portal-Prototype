import { useState } from "react";
import { T } from "../tokens";
import Avatar from "../components/Avatar";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Select from "../components/Select";
import Input from "../components/Input";
import Icon from "../components/Icon";
import { getInitials, timeAgo } from "../utils/formatting";
import { roleLabel } from "../utils/statusHelpers";
import { firebaseService } from "../services/firebaseService";
import { logger } from "../services/logger";
import { staffInviteSchema } from "../lib/schemas";
import type { Staff, UserRole, UserInvitation } from "../types";

const ROLE_COLORS: Record<string, string> = {
  admin:        T.accent,
  nurse:        T.info,
  homemaker:    T.warn,
  office_staff: T.purple,
};

interface TeamViewProps {
  user: Staff;
  staff: Staff[];
  invitations: UserInvitation[];
  onInvite: (email: string, role: UserRole) => Promise<void>;
  onSuspend: (uid: string) => Promise<void>;
  onReactivate: (uid: string) => Promise<void>;
  onChangeRole: (uid: string, role: UserRole) => Promise<void>;
  onRevokeInvite: (id: string) => Promise<void>;
}

export default function TeamView({
  user,
  staff,
  invitations,
  onInvite,
  onSuspend,
  onReactivate,
  onChangeRole,
  onRevokeInvite,
}: TeamViewProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState<UserRole | "">("");
  const [inviting,    setInviting]    = useState(false);
  const [inviteSent,  setInviteSent]  = useState("");
  const [inviteError, setInviteError] = useState("");
  const [emailError,  setEmailError]  = useState("");
  const [roleError,   setRoleError]   = useState("");

  const isAdmin = user.role === "admin";

  async function handleInvite() {
    const parsed = staffInviteSchema.safeParse({ email: inviteEmail.trim(), role: inviteRole || undefined });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      setEmailError(issues.find((i) => i.path[0] === "email")?.message ?? "");
      setRoleError(issues.find((i) => i.path[0] === "role")?.message ?? "");
      return;
    }
    setEmailError("");
    setRoleError("");
    setInviting(true);
    setInviteError("");
    try {
      await onInvite(inviteEmail.trim(), inviteRole as UserRole);
      setInviteSent(inviteEmail.trim());
      setInviteEmail("");
      setInviteRole("");
      setTimeout(() => setInviteSent(""), 4000);
    } catch (err: unknown) {
      logger.error("TeamView", "Invite error", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setInviteError(`Failed to send invitation: ${msg}`);
    } finally {
      setInviting(false);
    }
  }

  const activeStaff    = staff.filter((s) => s.status === "active");
  const suspendedStaff = staff.filter((s) => s.status === "suspended" || s.status === "inactive");
  const pendingInvites = invitations.filter((i) => i.status === "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 760 }}>

      {/* Invite card — admin only */}
      {isAdmin && (
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: T.accentLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="team" size={20} color={T.accent} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                Invite New Staff Member
              </h3>
              <p style={{ fontSize: 13, color: T.textSub, marginBottom: 16 }}>
                Send an invitation email to add a new team member to the portal.
              </p>

              {inviteSent ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 14px",
                    background: T.accentLight,
                    borderRadius: T.radiusSm,
                    border: `1px solid ${T.accent}30`,
                  }}
                >
                  <Icon name="check" size={16} color={T.accent} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>
                    Invitation sent to {inviteSent}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <Input
                      label="Email address"
                      type="email"
                      placeholder="colleague@parrish.health"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setEmailError(""); setInviteError(""); }}
                      error={emailError}
                      wrapStyle={{ flex: 1, minWidth: 220 }}
                    />
                    <Select
                      label="Role"
                      value={inviteRole}
                      onChange={(e) => { setInviteRole(e.target.value as UserRole); setRoleError(""); }}
                      error={roleError}
                      style={{ width: 170 }}
                    >
                      <option value="">Select role…</option>
                      <option value="admin">Admin</option>
                      <option value="nurse">Nurse</option>
                      <option value="homemaker">Homemaker</option>
                      <option value="office_staff">Office Staff</option>
                    </Select>
                    <Btn
                      variant="primary"
                      icon="plus"
                      onClick={handleInvite}
                      disabled={inviting}
                      style={{ marginBottom: emailError || roleError ? 18 : 0 }}
                    >
                      {inviting ? "Sending…" : "Send Invite"}
                    </Btn>
                  </div>
                  {inviteError && (
                    <p style={{ fontSize: 12, color: T.urgent }}>{inviteError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Pending invitations */}
      {isAdmin && pendingInvites.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Pending Invitations</h3>
            <span style={{ fontSize: 12, color: T.textSub, background: T.bgSub, padding: "2px 8px", borderRadius: 10 }}>
              {pendingInvites.length}
            </span>
          </div>
          <Card padding={0}>
            {pendingInvites.map((inv, i) => (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 20px",
                  borderBottom: i < pendingInvites.length - 1 ? `1px solid ${T.borderLight}` : "none",
                }}
              >
                <Icon name="user" size={18} color={T.textLight} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{inv.email}</p>
                  <p style={{ fontSize: 12, color: T.textSub }}>
                    {roleLabel(inv.role)} · Invited by {inv.invitedByName}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.warn,
                    background: T.warnLight,
                    padding: "3px 8px",
                    borderRadius: 10,
                    flexShrink: 0,
                  }}
                >
                  Pending
                </span>
                <Btn
                  variant="secondary"
                  size="sm"
                  icon="x"
                  onClick={() => onRevokeInvite(inv.id)}
                >
                  Revoke
                </Btn>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Active staff list */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Active Staff</h3>
          <span style={{ fontSize: 12, color: T.textSub, background: T.bgSub, padding: "2px 8px", borderRadius: 10 }}>
            {activeStaff.length}
          </span>
        </div>
        <Card padding={0}>
          {activeStaff.map((s, i) => (
            <StaffRow
              key={s.uid}
              staff={s}
              currentUser={user}
              isAdmin={isAdmin}
              last={i === activeStaff.length - 1}
              onSuspend={onSuspend}
              onChangeRole={onChangeRole}
            />
          ))}
        </Card>
      </div>

      {/* Suspended / inactive */}
      {suspendedStaff.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: T.textSub, marginBottom: 12 }}>Suspended / Inactive</h3>
          <Card padding={0}>
            {suspendedStaff.map((s, i) => (
              <StaffRow
                key={s.uid}
                staff={s}
                currentUser={user}
                isAdmin={isAdmin}
                last={i === suspendedStaff.length - 1}
                onSuspend={onSuspend}
                onReactivate={onReactivate}
                onChangeRole={onChangeRole}
              />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Staff row ────────────────────────────────────────────────────────────────

interface StaffRowProps {
  staff: Staff;
  currentUser: Staff;
  isAdmin: boolean;
  last: boolean;
  onSuspend: (uid: string) => Promise<void>;
  onReactivate?: (uid: string) => Promise<void>;
  onChangeRole: (uid: string, role: UserRole) => Promise<void>;
}

function StaffRow({ staff, currentUser, isAdmin, last, onSuspend, onReactivate, onChangeRole }: StaffRowProps) {
  const color     = ROLE_COLORS[staff.role] ?? T.accent;
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [loginHistory, setLoginHistory] = useState<Array<{ id: string; timestamp: number; userAgent: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const isSelf    = staff.uid === currentUser.uid;
  const canAct    = isAdmin && !isSelf && staff.status === "active";
  const canReactivate = isAdmin && !isSelf && staff.status === "suspended";

  async function handleSuspend() {
    setSaving(true);
    setError("");
    try { await onSuspend(staff.uid); }
    catch { setError("Failed to suspend."); }
    finally { setSaving(false); }
  }

  async function handleReactivate() {
    if (!onReactivate) return;
    setSaving(true);
    setError("");
    try { await onReactivate(staff.uid); }
    catch { setError("Failed to reactivate."); }
    finally { setSaving(false); }
  }

  async function handleRoleChange(role: UserRole) {
    setSaving(true);
    setError("");
    try { await onChangeRole(staff.uid, role); }
    catch { setError("Failed to update role."); }
    finally { setSaving(false); }
  }

  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: last ? "none" : `1px solid ${T.borderLight}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Avatar + status dot */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar initials={getInitials(staff.displayName)} color={color} size={42} />
          <span
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: staff.status === "active" ? T.accent : T.textLight,
              border: `2px solid ${T.bgCard}`,
            }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>
            {staff.displayName}
            {isSelf && (
              <span style={{ fontSize: 11, color: T.textLight, fontWeight: 400, marginLeft: 6 }}>(you)</span>
            )}
          </p>
          <p style={{ fontSize: 12, color: T.textSub }}>{staff.email}</p>
        </div>

        {/* Role — dropdown if admin and not self, else badge */}
        {canAct ? (
          <select
            value={staff.role}
            disabled={saving}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color,
              background: color + "18",
              border: "none",
              borderRadius: 20,
              padding: "4px 10px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <option value="admin">Admin</option>
            <option value="nurse">Nurse</option>
            <option value="homemaker">Homemaker</option>
            <option value="office_staff">Office Staff</option>
          </select>
        ) : (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              background: color + "18",
              color,
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {roleLabel(staff.role)}
          </span>
        )}

        {/* Suspend button */}
        {canAct && (
          <Btn
            variant="secondary"
            size="sm"
            icon="x"
            onClick={handleSuspend}
            disabled={saving}
          >
            {saving ? "…" : "Suspend"}
          </Btn>
        )}

        {/* Status for non-active */}
        {staff.status !== "active" && (
          <span style={{ fontSize: 12, color: T.textLight, fontWeight: 500, flexShrink: 0 }}>
            {staff.status === "suspended" ? "Suspended" : "Inactive"}
          </span>
        )}

        {/* Reactivate button for suspended staff */}
        {canReactivate && (
          <Btn
            variant="secondary"
            size="sm"
            icon="check"
            onClick={handleReactivate}
            disabled={saving}
          >
            {saving ? "…" : "Reactivate"}
          </Btn>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: T.urgent, marginTop: 6, marginLeft: 56 }}>{error}</p>
      )}

      {/* Login history toggle — admin only */}
      {isAdmin && (
        <button
          onClick={async () => {
            if (!showHistory && loginHistory.length === 0) {
              setHistoryLoading(true);
              try {
                const history = await firebaseService.getLoginHistory(staff.uid);
                setLoginHistory(history);
              } catch { /* ignore */ }
              setHistoryLoading(false);
            }
            setShowHistory((s) => !s);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 8,
            marginLeft: 56,
            fontSize: 11,
            color: T.textLight,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: T.font,
            padding: 0,
          }}
        >
          <Icon name="dashboard" size={12} color={T.textLight} />
          {historyLoading ? "Loading…" : showHistory ? "Hide login history" : "Login history"}
        </button>
      )}

      {showHistory && loginHistory.length > 0 && (
        <div style={{ marginTop: 6, marginLeft: 56 }}>
          {loginHistory.map((entry) => (
            <div key={entry.id} style={{ fontSize: 11, color: T.textSub, padding: "3px 0", display: "flex", gap: 8 }}>
              <span style={{ color: T.textLight, minWidth: 100 }}>{new Date(entry.timestamp).toLocaleString()}</span>
              <span>{timeAgo(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      )}

      {showHistory && loginHistory.length === 0 && !historyLoading && (
        <p style={{ fontSize: 11, color: T.textLight, marginTop: 6, marginLeft: 56 }}>No login history recorded.</p>
      )}
    </div>
  );
}
