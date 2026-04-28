// Parrish HALO design tokens. Values align with the unified HALO branding guide
// so all three apps (CTI, LMS, DME) read from the same palette and type scale.
// Existing key names are preserved so components continue to compile.

export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg:           "#FAFBF9", // app canvas
  bgSub:        "#F4F5F0", // page header strip, subtle surfaces
  bgCard:       "#FFFFFF",
  bgHover:      "rgba(30,158,73,0.06)", // subtle green tint on hover

  // Sidebar (dark navy surface)
  bgSidebar:         "#011E84",
  bgSidebarHover:    "#092783",
  bgSidebarActive:   "#0D529D",

  // ── Brand / Primary (HALO Green) ────────────────────────────────────────
  accent:       "#1E9E49",
  accentLight:  "#E8F5EE",
  accentDark:   "#178A3E",
  accentGhost:  "rgba(30,158,73,0.08)",

  // ── Secondary (HALO Blue) ───────────────────────────────────────────────
  secondary:      "#0D529D",
  secondaryHover: "#0A61A0",
  secondaryLight: "#EEF3FB",

  // DME app accent (thin accents only, per guide §3.3)
  appAccent:    "#2C70B9",

  // ── Semantic colors ─────────────────────────────────────────────────────
  urgent:       "#DC3545",
  urgentLight:  "#FDECEA",
  warn:         "#E6A817",
  warnLight:    "#FEF9E7",
  info:         "#0D529D",
  infoLight:    "#EEF3FB",
  // Purple preserved for role colour variety. Mapped to HALO blue-mid.
  purple:       "#3C55A0",
  purpleLight:  "#E5EAF4",

  // ── Text ────────────────────────────────────────────────────────────────
  text:         "#1A2E28", // primary headings/body
  textSub:      "#3D5450", // body paragraphs
  textLight:    "#7A938D", // muted/helper text
  textOnDark:   "#FFFFFF",
  textOnDarkMuted: "rgba(255,255,255,0.62)",
  textLink:     "#0D529D",

  // ── Borders ─────────────────────────────────────────────────────────────
  border:       "#D1D9D5", // input borders
  borderLight:  "#E8EBE6", // card/dividers

  // ── Elevation ───────────────────────────────────────────────────────────
  shadow:       "0 1px 4px rgba(1,30,132,0.05)",
  shadowMd:     "0 4px 12px rgba(1,30,132,0.08)",
  shadowLg:     "0 8px 30px rgba(1,30,132,0.10)",
  shadowCardHover: "0 6px 20px rgba(1,30,132,0.10)",

  // Modal backdrop (tinted brand navy per spec)
  overlay:      "rgba(1,30,132,0.40)",

  // ── Shape ───────────────────────────────────────────────────────────────
  radius:       "14px", // card / modal default
  radiusSm:     "10px", // buttons, inputs, nav items
  radiusXs:     "6px",
  radiusLg:     "18px",
  radiusFull:   "9999px",

  // ── Typography ──────────────────────────────────────────────────────────
  font:         "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontDisplay:  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSerif:    "'Source Serif 4', Georgia, 'Times New Roman', serif",
} as const;

export type Tokens = typeof T;
