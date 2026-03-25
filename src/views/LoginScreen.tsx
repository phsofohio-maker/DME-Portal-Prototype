import { useState } from "react";
import { T } from "../tokens";
import { STAFF } from "../data/staff";
import { roleLabel } from "../utils/statusHelpers";
import { signIn } from "../services/authService";
import type { UserRole } from "../types";

const ROLE_COLORS: Record<UserRole, string> = {
  admin:        T.accent,
  nurse:        T.info,
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
      // App.tsx onAuthStateChanged fires automatically — no setUser needed here
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
        <span style={{ fontSize: 11, color: T.textLight, fontWeight: 500, whiteSpace: "nowrap" }}>
          DEV — quick sign in
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
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
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
                  padding: "2px 8px",
                  borderRadius: 20,
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

  const displayError = error || externalError || "";

  const isDev = import.meta.env.DEV;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // onAuthStateChanged in App.tsx handles the rest
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 460 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: T.accent,
              marginBottom: 16,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1
            style={{
              fontFamily: T.fontDisplay,
              fontSize: 32,
              fontWeight: 400,
              color: T.text,
              marginBottom: 6,
              letterSpacing: "-0.3px",
            }}
          >
            Parrish Health
          </h1>
          <p style={{ fontSize: 15, color: T.textSub }}>DME Portal — Staff Access</p>
        </div>

        {/* Card */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.borderLight}`,
            borderRadius: T.radius,
            boxShadow: T.shadowLg,
            padding: 32,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 20 }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.3 }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@parrish.health"
                style={{
                  fontSize: 14,
                  color: T.text,
                  background: T.bgCard,
                  border: `1px solid ${displayError ? T.urgent : T.border}`,
                  borderRadius: T.radiusSm,
                  padding: "10px 12px",
                  outline: "none",
                  fontFamily: T.font,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.3 }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your password"
                style={{
                  fontSize: 14,
                  color: T.text,
                  background: T.bgCard,
                  border: `1px solid ${displayError ? T.urgent : T.border}`,
                  borderRadius: T.radiusSm,
                  padding: "10px 12px",
                  outline: "none",
                  fontFamily: T.font,
                }}
              />
            </div>

            {displayError && (
              <p style={{ fontSize: 13, color: T.urgent, fontWeight: 500, marginTop: -4 }}>{displayError}</p>
            )}

            <button
              type="submit"
              disabled={loading || devSigningIn || !email || !password}
              style={{
                marginTop: 4,
                padding: "11px 0",
                background: loading ? T.accent + "80" : T.accent,
                color: "#fff",
                border: "none",
                borderRadius: T.radiusSm,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: loading || !email || !password ? "default" : "pointer",
                opacity: !email || !password ? 0.6 : 1,
                transition: "opacity 0.12s",
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {isDev && !devSigningIn && (
            <DevQuickSelect onSigningIn={() => setDevSigningIn(true)} />
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: T.textLight }}>
          {isDev ? "Dev mode · Firebase Auth" : "Parrish Health DME Portal"}
        </p>
      </div>
    </div>
  );
}
