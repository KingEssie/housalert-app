export const BRAND = {
  primary: "#d91a68",
  primaryEnd: "#b31556",
  primaryHover: "#b31556",
  gradient: "linear-gradient(135deg, #d91a68, #b31556)",
  primaryLight: "rgba(217, 26, 104, 0.08)",
  primaryLighter: "rgba(217, 26, 104, 0.04)",
  primaryBorder: "rgba(217, 26, 104, 0.3)",
  primaryShadow: "rgba(217, 26, 104, 0.2)",
} as const;

export const theme = {
  colors: {
    primary: BRAND.primary,
    primaryHover: BRAND.primaryHover,
    primaryLight: BRAND.primaryLight,
    iconBackground: BRAND.primaryLight,
    neon: BRAND.primary,
    darkLabel: "#111111",
    successMain: "#16A34A",
    successDark: "#16A34A",
    successLight: "rgba(22, 163, 74, 0.08)",
    textPrimary: "#111111",
    textSecondary: "#6B7280",
    textTertiary: "#6B7280",
    background: "#FFFFFF",
    backgroundSoft: "#F9FAFB",
    inputBackground: "#FFFFFF",
    border: "#E5E7EB",
    divider: "#F0F0F0",
    cardBackground: "#FFFFFF",
  },
  radius: {
    sm: "12px",
    md: "16px",
    lg: "20px",
    pill: "999px",
  },
  shadow: {
    card: "0 2px 8px rgba(0,0,0,0.04)",
    overlay: "0 2px 6px rgba(0,0,0,0.08)",
  },
} as const;

export type ThemeColors = typeof theme.colors;
