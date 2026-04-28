import { useState } from "react";
import { T } from "../tokens";
import Icon from "./Icon";

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
type BtnSize = "sm" | "md";

interface BtnProps {
  variant?: BtnVariant;
  size?: BtnSize;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit";
  icon?: Parameters<typeof Icon>[0]["name"];
  iconRight?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "none",
  borderRadius: T.radiusSm,
  fontFamily: T.font,
  fontWeight: 600,
  letterSpacing: "-0.005em",
  cursor: "pointer",
  transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.08s ease",
  whiteSpace: "nowrap",
  lineHeight: 1.4,
};

const sizes: Record<BtnSize, React.CSSProperties> = {
  sm: { fontSize: 13, padding: "6px 14px" },
  md: { fontSize: 14, padding: "9px 18px" },
};

type VariantStyle = {
  default: React.CSSProperties;
  hover: React.CSSProperties;
  disabled: React.CSSProperties;
};

const variants: Record<BtnVariant, VariantStyle> = {
  // HALO green primary
  primary: {
    default: {
      background: T.accent,
      color: "#fff",
      border: `1px solid ${T.accent}`,
      boxShadow: "none",
    },
    hover: {
      background: T.accentDark,
      color: "#fff",
      border: `1px solid ${T.accentDark}`,
      boxShadow: "0 2px 8px rgba(30,158,73,0.25)",
    },
    disabled: {
      background: T.border,
      color: T.textLight,
      border: `1px solid ${T.border}`,
      boxShadow: "none",
    },
  },
  // Neutral outline (kept as "secondary" for back-compat with existing callsites)
  secondary: {
    default: {
      background: T.bgCard,
      color: T.text,
      border: `1px solid ${T.border}`,
      boxShadow: "none",
    },
    hover: {
      background: T.bgSub,
      color: T.text,
      border: `1px solid ${T.textLight}`,
      boxShadow: "none",
    },
    disabled: {
      background: T.bgCard,
      color: T.textLight,
      border: `1px solid ${T.border}`,
      boxShadow: "none",
    },
  },
  danger: {
    default: {
      background: T.urgent,
      color: "#fff",
      border: `1px solid ${T.urgent}`,
      boxShadow: "none",
    },
    hover: {
      background: "#C82333",
      color: "#fff",
      border: "1px solid #C82333",
      boxShadow: "0 2px 8px rgba(220,53,69,0.25)",
    },
    disabled: {
      background: T.border,
      color: T.textLight,
      border: `1px solid ${T.border}`,
      boxShadow: "none",
    },
  },
  ghost: {
    default: {
      background: "transparent",
      color: T.textSub,
      border: "1px solid transparent",
      boxShadow: "none",
    },
    hover: {
      background: T.bgSub,
      color: T.text,
      border: "1px solid transparent",
      boxShadow: "none",
    },
    disabled: {
      background: "transparent",
      color: T.textLight,
      border: "1px solid transparent",
      boxShadow: "none",
    },
  },
};

export default function Btn({
  variant = "primary",
  size = "md",
  onClick,
  disabled = false,
  fullWidth = false,
  type = "button",
  icon,
  iconRight = false,
  children,
  style,
}: BtnProps) {
  const [hovered, setHovered] = useState(false);

  const v = variants[variant];
  const s = sizes[size];
  const stateStyle = disabled ? v.disabled : hovered ? v.hover : v.default;

  const iconColor =
    disabled ? T.textLight :
    variant === "primary" || variant === "danger" ? "#fff" :
    hovered ? T.text : T.textSub;

  const iconEl = icon ? (
    <Icon name={icon} size={size === "sm" ? 14 : 15} color={iconColor} />
  ) : null;

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...base,
        ...s,
        ...stateStyle,
        width: fullWidth ? "100%" : undefined,
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {!iconRight && iconEl}
      {children}
      {iconRight && iconEl}
    </button>
  );
}
