import { useState } from "react";
import { T } from "../tokens";

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "style"> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function Select({
  label,
  error,
  hint,
  required,
  style,
  children,
  ...rest
}: SelectProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
      {label && (
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.textSub,
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {label}
          {required && <span style={{ color: T.urgent, marginLeft: 3 }}>*</span>}
        </label>
      )}
      <select
        {...rest}
        style={{
          width: "100%",
          fontSize: 14,
          color: rest.value === "" ? T.textLight : T.text,
          background: T.bgCard,
          border: `1px solid ${hasError ? T.urgent : focused ? T.accent : T.border}`,
          borderRadius: T.radiusSm,
          padding: "10px 12px",
          outline: "none",
          fontFamily: T.font,
          appearance: "none",
          cursor: "pointer",
          transition: "border-color 0.12s",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A746C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          paddingRight: 32,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {children}
      </select>
      {hint && !error && (
        <span style={{ fontSize: 11, color: T.textLight }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{error}</span>
      )}
    </div>
  );
}
