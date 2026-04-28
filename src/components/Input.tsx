import { useState } from "react";
import { T } from "../tokens";

interface SharedProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  wrapStyle?: React.CSSProperties;
}

export interface InputProps extends SharedProps, React.InputHTMLAttributes<HTMLInputElement> {
  as?: "input";
}

export interface TextareaProps extends SharedProps, React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  as: "textarea";
}

function fieldBase(focused: boolean, hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    fontSize: 15,
    color: T.text,
    background: T.bgCard,
    border: `1.5px solid ${hasError ? T.urgent : focused ? T.accent : T.border}`,
    borderRadius: T.radiusSm,
    padding: "10px 12px",
    outline: "none",
    fontFamily: T.font,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    boxSizing: "border-box",
    boxShadow: focused && !hasError ? `0 0 0 3px ${T.accentGhost}` : "none",
  };
}

function LabelRow({ label, required }: { label?: string; required?: boolean }) {
  if (!label) return null;
  return (
    <label
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: T.text,
      }}
    >
      {label}
      {required && <span style={{ color: T.urgent, marginLeft: 3 }}>*</span>}
    </label>
  );
}

function Meta({ hint, error }: { hint?: string; error?: string }) {
  if (error) return <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{error}</span>;
  if (hint)  return <span style={{ fontSize: 11, color: T.textLight }}>{hint}</span>;
  return null;
}

export default function Input(props: InputProps | TextareaProps) {
  const [focused, setFocused] = useState(false);

  if (props.as === "textarea") {
    const { as: _as, label, error, hint, required, wrapStyle, rows = 3, ...rest } = props;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, ...wrapStyle }}>
        <LabelRow label={label} required={required} />
        <textarea
          {...rest}
          rows={rows}
          style={{ ...fieldBase(focused, Boolean(error)), resize: "vertical", lineHeight: 1.5 }}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e)  => { setFocused(false); rest.onBlur?.(e); }}
        />
        <Meta hint={hint} error={error} />
      </div>
    );
  }

  const { as: _as, label, error, hint, required, wrapStyle, ...rest } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...wrapStyle }}>
      <LabelRow label={label} required={required} />
      <input
        {...rest}
        style={fieldBase(focused, Boolean(error))}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e)  => { setFocused(false); rest.onBlur?.(e); }}
      />
      <Meta hint={hint} error={error} />
    </div>
  );
}
