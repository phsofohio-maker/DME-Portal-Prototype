import { useState } from "react";
import { T } from "../tokens";

interface CardProps {
  children: React.ReactNode;
  hoverable?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  padding?: number | string;
}

export default function Card({
  children,
  hoverable = false,
  onClick,
  style,
  padding = 20,
}: CardProps) {
  const [hovered, setHovered] = useState(false);

  const isInteractive = hoverable || Boolean(onClick);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => isInteractive && setHovered(true)}
      onMouseLeave={() => isInteractive && setHovered(false)}
      style={{
        background: T.bgCard,
        border: `1px solid ${T.borderLight}`,
        borderRadius: T.radius,
        boxShadow: hovered && isInteractive ? T.shadowLg : T.shadow,
        padding,
        cursor: onClick ? "pointer" : undefined,
        transform: hovered && isInteractive ? "translateY(-1px)" : "translateY(0)",
        transition: "box-shadow 0.15s, transform 0.15s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
