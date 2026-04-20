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
