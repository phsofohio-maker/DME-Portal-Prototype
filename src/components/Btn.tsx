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
  cursor: "pointer",
  transition: "background 0.12s, color 0.12s, border-color 0.12s, box-shadow 0.12s",
  whiteSpace: "nowrap",
};

const sizes: Record<BtnSize, React.CSSProperties> = {
  sm: { fontSize: 12, padding: "6px 12px" },
  md: { fontSize: 14, padding: "9px 16px" },
};

type VariantStyle = {
  default: React.CSSProperties;
  hover: React.CSSProperties;
  disabled: React.CSSProperties;
};

const variants: Record<BtnVariant, VariantStyle> = {
  primary: {
    default:  { background: T.accent,    color: "#fff",    border: `1px solid ${T.accent}`    },
    hover:    { background: T.accentDark, color: "#fff",   border: `1px solid ${T.accentDark}` },
    disabled: { background: T.border,    color: T.textLight, border: `1px solid ${T.border}`  },
  },
  secondary: {
    default:  { background: T.bgCard,    color: T.text,    border: `1px solid ${T.border}`    },
    hover:    { background: T.bgHover,   color: T.text,    border: `1px solid ${T.border}`    },
    disabled: { background: T.bgCard,    color: T.textLight, border: `1px solid ${T.border}`  },
  },
  danger: {
    default:  { background: T.urgent,    color: "#fff",    border: `1px solid ${T.urgent}`    },
    hover:    { background: "#A8402A",   color: "#fff",    border: `1px solid #A8402A`         },
    disabled: { background: T.border,    color: T.textLight, border: `1px solid ${T.border}`  },
  },
  ghost: {
    default:  { background: "transparent", color: T.textSub, border: "1px solid transparent"  },
    hover:    { background: T.bgSub,     color: T.text,    border: "1px solid transparent"    },
    disabled: { background: "transparent", color: T.textLight, border: "1px solid transparent"},
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
