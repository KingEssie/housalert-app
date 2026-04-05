export const BRAND = {
  primary: "#FF385C",
  primaryEnd: "#D70466",
  primaryHover: "#E6284B",
  gradient: "linear-gradient(135deg, #FF385C, #D70466)",
  primaryLight: "rgba(255, 56, 92, 0.08)",
  primaryLighter: "rgba(255, 56, 92, 0.04)",
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
    textTertiary: "#9CA3AF",
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
