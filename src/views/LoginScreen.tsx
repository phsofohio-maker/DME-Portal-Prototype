import { useState } from "react";
import { T } from "../tokens";
import { STAFF } from "../data/staff";
import { roleLabel } from "../utils/statusHelpers";
import { signIn } from "../services/authService";
import type { UserRole } from "../types";

const ROLE_COLORS: Record<UserRole, string> = {
  admin:        T.accent,
  nurse:        T.secondary,
  homemaker:    T.warn,
  office_staff: T.purple,
};

// ─── Dev quick-select (DEV only) ──────────────────────────────────────────────

function DevQuickSelect({ onSigningIn }: { onSigningIn: (id: string) => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(uid: string, email: string) {
    setLoading(uid);
    try {
      await signIn(email, "Parrish2024!");
    } catch {
      setLoading(null);
    }
    onSigningIn(uid);
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1, height: 1, background: T.borderLight }} />
        <span
          style={{
            fontSize: 11,
            color: T.textLight,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Dev — quick sign in
        </span>
        <div style={{ flex: 1, height: 1, background: T.borderLight }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {STAFF.map((staff) => {
          const color = ROLE_COLORS[staff.role];
          const isLoading = loading === staff.uid;
          const isDisabled = loading !== null && !isLoading;

          return (
            <button
              key={staff.uid}
              onClick={() => !isDisabled && !isLoading && handleSelect(staff.uid, staff.email)}
              disabled={isDisabled || isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 14px",
                background: T.bgCard,
                border: `1px solid ${T.borderLight}`,
                borderRadius: T.radiusSm,
                cursor: isDisabled ? "default" : "pointer",
                opacity: isDisabled ? 0.45 : 1,
                fontFamily: T.font,
                textAlign: "left",
                width: "100%",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: T.radiusFull,
                  background: color + "18",
                  color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {isLoading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
                    </path>
                  </svg>
                ) : (
                  staff.displayName.split(" ").map((w) => w[0]).join("").slice(0, 2)
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                  {isLoading ? "Signing in…" : staff.displayName}
                </p>
                <p style={{ fontSize: 11, color: T.textSub, marginTop: 1 }}>{staff.email}</p>
              </div>
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: T.radiusFull,
                  background: color + "18",
                  color,
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {roleLabel(staff.role)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────

export default function LoginScreen({ externalError }: { externalError?: string }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [devSigningIn, setDevSigningIn] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const displayError = error || externalError || "";
  const isDev = import.meta.env.DEV;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Invalid email or password.");
      } else if (msg.includes("too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    fontSize: 15,
    color: T.text,
    background: T.bgCard,
    border: `1.5px solid ${displayError ? T.urgent : focused ? T.accent : T.border}`,
    borderRadius: T.radiusSm,
    padding: "10px 12px",
    outline: "none",
    fontFamily: T.font,
    boxShadow: focused && !displayError ? `0 0 0 3px ${T.accentGhost}` : "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: T.bg,
        backgroundImage: "url('/images/HALO_Background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Auth card with glass surface */}
        <div
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${T.borderLight}`,
            borderRadius: T.radiusLg,
            boxShadow: T.shadowLg,
            padding: "40px 36px 32px",
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img
              src="/images/HALO_DMEEPS_.svg"
              alt="Parrish HALO DME"
              style={{
                width: 280,
                maxWidth: "100%",
                height: "auto",
                objectFit: "contain",
                display: "inline-block",
              }}
            />
            <p style={{ fontSize: 14, color: T.textLight, marginTop: 10, fontWeight: 500 }}>
              Nurse Owned &amp; Operated
            </p>
          </div>

          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: T.text,
              marginBottom: 6,
              letterSpacing: "-0.01em",
            }}
          >
            Sign in to your account
          </h2>
          <p style={{ fontSize: 13, color: T.textSub, marginBottom: 22 }}>
            Staff access — DME Portal
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="you@parrish.health"
                style={inputStyle(emailFocused)}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Enter your password"
                style={inputStyle(passwordFocused)}
              />
            </div>

            {displayError && (
              <p style={{ fontSize: 12, color: T.urgent, fontWeight: 500, marginTop: -4 }}>{displayError}</p>
            )}

            <button
              type="submit"
              disabled={loading || devSigningIn || !email || !password}
              style={{
                marginTop: 8,
                padding: "12px 0",
                background: loading ? T.accent : T.accent,
                color: "#fff",
                border: "none",
                borderRadius: T.radiusSm,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: loading || !email || !password ? "default" : "pointer",
                opacity: !email || !password ? 0.55 : 1,
                transition: "opacity 0.15s ease, box-shadow 0.15s ease",
                boxShadow: !email || !password ? "none" : "0 2px 8px rgba(30,158,73,0.25)",
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {isDev && !devSigningIn && (
            <DevQuickSelect onSigningIn={() => setDevSigningIn(true)} />
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 12,
            color: T.textLight,
            fontWeight: 500,
          }}
        >
          {isDev ? "Dev mode · Firebase Auth" : "© Parrish Health Systems of Ohio"}
        </p>
      </div>
    </div>
  );
}
