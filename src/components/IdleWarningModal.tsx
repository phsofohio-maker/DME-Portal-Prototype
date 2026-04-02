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
    : `${secs}s`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(44,40,37,0.5)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: T.bgCard,
          borderRadius: T.radius,
          boxShadow: T.shadowLg,
          padding: "32px 28px",
          maxWidth: 400,
          width: "90%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: T.warnLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="clock" size={28} color={T.warn} />
        </div>

        <div>
          <h2
            style={{
              fontFamily: T.fontDisplay,
              fontSize: 22,
              fontWeight: 400,
              color: T.text,
              marginBottom: 8,
            }}
          >
            Session Expiring
          </h2>
          <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.6 }}>
            Your session will expire due to inactivity in{" "}
            <strong style={{ color: T.warn, fontVariantNumeric: "tabular-nums" }}>
              {timeStr}
            </strong>
            . Any unsaved changes may be lost.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Btn variant="secondary" onClick={onLogout}>Log Out Now</Btn>
          <Btn variant="primary" onClick={onStay}>Stay Logged In</Btn>
        </div>
      </div>
    </div>
  );
}
