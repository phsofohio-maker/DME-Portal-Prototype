import { useState } from "react";
import { T } from "../tokens";
import Icon from "./Icon";

interface BackBtnProps {
  onClick: () => void;
  label?: string;
}

export default function BackBtn({ onClick, label = "Back" }: BackBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
        color: hovered ? T.text : T.textSub,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 0",
        fontFamily: T.font,
        transition: "color 0.12s",
      }}
    >
      <Icon name="arrow-left" size={15} color={hovered ? T.text : T.textSub} />
      {label}
    </button>
  );
}
