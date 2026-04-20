export const BRAND = {
  primary: "rgb(var(--ha-primary))",
  primaryEnd: "rgb(var(--ha-primary-hover))",
  primaryHover: "rgb(var(--ha-primary-hover))",
  gradient: "linear-gradient(135deg, rgb(var(--ha-primary)), rgb(var(--ha-primary-hover)))",
  primaryLight: "var(--ha-primary-light)",
  primaryLighter: "rgb(var(--ha-primary) / 0.04)",
  primaryBorder: "rgb(var(--ha-primary) / 0.3)",
  primaryShadow: "rgb(var(--ha-primary) / 0.2)",
  accent: "rgb(var(--ha-accent))",
  accentHover: "rgb(var(--ha-accent-hover))",
  accentLight: "var(--ha-accent-light)",
  accentShadow: "rgb(var(--ha-accent) / 0.25)",
  accentYellow: "rgb(var(--ha-accent-yellow))",
  accentYellowLight: "var(--ha-accent-yellow-light)",
  mint: "rgb(var(--ha-mint))",
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
