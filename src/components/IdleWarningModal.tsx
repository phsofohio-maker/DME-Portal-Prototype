import { T } from "../tokens";
import Btn from "./Btn";
import Icon from "./Icon";

interface IdleWarningModalProps {
  remainingSeconds: number;
  onStay: () => void;
  onLogout: () => void;
}

export default function IdleWarningModal({ remainingSeconds, onStay, onLogout }: IdleWarningModalProps) {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeStr = mins > 0
    ? `${mins}:${secs.toString().padStart(2, "0")}`
    : `0:${secs.toString().padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.overlay,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: 20,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
    >
      <div
        style={{
          background: T.bgCard,
          borderRadius: T.radius,
          boxShadow: T.shadowLg,
          maxWidth: 440,
          width: "100%",
          overflow: "hidden",
          fontFamily: T.font,
        }}
      >
        {/* Warning accent strip */}
        <div style={{ height: 3, background: T.warn }} />

        <div style={{ padding: "28px 28px 24px" }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: T.radiusFull,
                background: T.warnLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="clock" size={20} color={T.warn} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="idle-warning-title"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: T.text,
                  marginBottom: 4,
                  letterSpacing: "-0.01em",
                }}
              >
                Session Expiring
              </h2>
              <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.55 }}>
                You&rsquo;ll be logged out in{" "}
                <strong style={{ color: T.warn, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                  {timeStr}
                </strong>{" "}
                due to inactivity. Any unsaved changes have been auto-saved.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <Btn variant="secondary" onClick={onLogout}>Log Out Now</Btn>
            <Btn variant="primary" onClick={onStay}>Stay Logged In</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
