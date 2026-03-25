import { statusColor } from "../utils/statusHelpers";
import type { RequestStatus } from "../types";

interface StatusPillProps {
  status: RequestStatus;
}

export default function StatusPill({ status }: StatusPillProps) {
  const s = statusColor(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}
