// ─── Initials ─────────────────────────────────────────────────────────────────

export function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Time & Date ─────────────────────────────────────────────────────────────

export function timeAgo(value: string | number): string {
  const now = Date.now();
  const then = typeof value === "number" ? value : new Date(value).getTime();
  const diff = Math.floor((now - then) / 1000); // seconds

  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  const days = Math.floor(diff / 86400);
  if (days === 1)   return "yesterday";
  if (days < 7)     return `${days}d ago`;
  if (days < 30)    return `${Math.floor(days / 7)}w ago`;
  if (days < 365)   return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function fmtDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fmtShortDate(value: string | number): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(value: string | number): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Age ─────────────────────────────────────────────────────────────────────

export function calcAge(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
