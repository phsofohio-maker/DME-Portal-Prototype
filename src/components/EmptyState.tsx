import { T } from "../tokens";
import Icon from "./Icon";

interface EmptyStateProps {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: T.bgSub,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={24} color={T.textLight} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>{title}</p>
        {subtitle && (
          <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
