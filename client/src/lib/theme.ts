export const BRAND = {
  primary: "#253c96",
  primaryEnd: "#19244e",
  primaryHover: "#19244e",
  gradient: "linear-gradient(135deg, #253c96, #19244e)",
  primaryLight: "rgba(37, 60, 150, 0.08)",
  primaryLighter: "rgba(37, 60, 150, 0.04)",
  primaryBorder: "rgba(37, 60, 150, 0.3)",
  primaryShadow: "rgba(37, 60, 150, 0.2)",
  accent: "#f36b2e",
  accentHover: "#d45826",
  accentLight: "rgba(243, 107, 46, 0.08)",
  accentShadow: "rgba(243, 107, 46, 0.25)",
  accentYellow: "#f59a1e",
  accentYellowLight: "rgba(245, 154, 30, 0.08)",
  mint: "#c4e7e5",
} as const;

export const theme = {
  colors: {
    primary: BRAND.primary,
    primaryHover: BRAND.primaryHover,
    primaryLight: BRAND.primaryLight,
    iconBackground: BRAND.primaryLight,
    neon: BRAND.primary,
    darkLabel: "rgb(var(--ha-text))",
    successMain: "rgb(var(--ha-success))",
    successDark: "rgb(var(--ha-success))",
    successLight: "var(--ha-success-light)",
    textPrimary: "rgb(var(--ha-text))",
    textSecondary: "rgb(var(--ha-text-secondary))",
    textTertiary: "rgb(var(--ha-text-secondary))",
    background: "rgb(var(--ha-card))",
    backgroundSoft: "rgb(var(--ha-surface))",
    inputBackground: "rgb(var(--ha-card))",
    border: "rgb(var(--ha-card-border))",
    divider: "rgb(var(--ha-divider))",
    cardBackground: "rgb(var(--ha-card))",
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
};

export type ThemeColors = typeof theme.colors;
