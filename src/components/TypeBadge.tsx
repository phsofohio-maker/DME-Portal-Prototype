import { typeInfo } from "../utils/statusHelpers";
import type { RequestType } from "../types";

interface TypeBadgeProps {
  type: RequestType;
  short?: boolean;
}

export default function TypeBadge({ type, short = false }: TypeBadgeProps) {
  const t = typeInfo(type);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 4,
        background: t.bg,
        color: t.color,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        letterSpacing: 0.2,
      }}
    >
      {short ? t.shortLabel : t.label}
    </span>
  );
}
