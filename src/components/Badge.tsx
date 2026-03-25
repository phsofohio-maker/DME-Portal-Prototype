interface BadgeProps {
  count: number;
}

export default function Badge({ count }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 9,
        background: "#C4533A",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
