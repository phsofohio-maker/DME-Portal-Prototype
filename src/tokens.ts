export const T = {
  // Backgrounds
  bg: "#F7F4EF",
  bgSub: "#EFEBE4",
  bgCard: "#FFFFFF",
  bgHover: "#F0EDE6",

  // Brand / Accent
  accent: "#5B7A5E",
  accentLight: "#E8F0E9",
  accentDark: "#3D5A40",

  // Semantic colors
  urgent: "#C4533A",
  urgentLight: "#FCEAE6",
  warn: "#C9972D",
  warnLight: "#FFF7E6",
  info: "#4A7A9B",
  infoLight: "#E6F0F7",
  purple: "#7B61A8",
  purpleLight: "#F0ECF6",

  // Text
  text: "#2C2825",
  textSub: "#7A746C",
  textLight: "#A9A29A",

  // Borders
  border: "#E2DDD5",
  borderLight: "#EDE9E2",

  // Elevation
  shadow: "0 1px 3px rgba(44,40,37,0.06), 0 1px 2px rgba(44,40,37,0.04)",
  shadowLg: "0 4px 16px rgba(44,40,37,0.08), 0 2px 6px rgba(44,40,37,0.04)",

  // Shape
  radius: "10px",
  radiusSm: "6px",

  // Typography
  font: "'DM Sans', sans-serif",
  fontDisplay: "'Instrument Serif', serif",
} as const;

export type Tokens = typeof T;
