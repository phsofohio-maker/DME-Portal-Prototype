interface AvatarProps {
  initials: string;
  color?: string;
  size?: number;
}

export default function Avatar({ initials, color = "#5B7A5E", size = 36 }: AvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color + "18",
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}
