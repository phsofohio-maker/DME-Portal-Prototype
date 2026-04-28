import { useCallback, useEffect, useState, type ReactNode } from "react";
import { T } from "../tokens";
import Icon from "./Icon";
import { ToastContext, type ToastApi, type ToastVariant } from "../hooks/useToast";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const VARIANT_COLORS: Record<ToastVariant, { bg: string; fg: string; border: string; icon: "check" | "alert" | "bell" }> = {
  success: { bg: T.accentLight,  fg: T.accentDark, border: T.accent,  icon: "check" },
  error:   { bg: T.urgentLight,  fg: T.urgent,     border: T.urgent,  icon: "alert" },
  info:    { bg: T.infoLight,    fg: T.info,       border: T.info,    icon: "bell"  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((curr) => [...curr, { id, message, variant }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const api: ToastApi = {
    success: (m) => push("success", m),
    error:   (m) => push("error",   m),
    info:    (m) => push("info",    m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 2000,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const colors = VARIANT_COLORS[item.variant];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="status"
      style={{
        pointerEvents: "auto",
        minWidth: 280,
        maxWidth: 380,
        padding: "12px 14px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: T.radiusSm,
        boxShadow: T.shadowMd,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        opacity: visible ? 1 : 0,
        transition: "transform 200ms ease, opacity 200ms ease",
        fontFamily: T.font,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon name={colors.icon} size={16} color={colors.fg} />
      </span>
      <span style={{ flex: 1, fontSize: 13, color: T.text, lineHeight: 1.4 }}>
        {item.message}
      </span>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 2,
          color: T.textLight,
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
