import { T } from "../tokens";

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  style?: React.CSSProperties;
}

export default function InfoRow({ label, value, style }: InfoRowProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, ...style }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: T.textSub,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, color: T.text, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}
