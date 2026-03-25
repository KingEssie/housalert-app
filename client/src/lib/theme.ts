export const theme = {
  colors: {
    primary: "rgb(var(--ha-primary))",
    primaryHover: "rgb(var(--ha-primary-hover))",
    primaryLight: "var(--ha-primary-light)",
    iconBackground: "var(--ha-primary-light)",
    neon: "#CBFF02",
    darkLabel: "rgb(var(--ha-text))",
    successMain: "rgb(var(--ha-success))",
    successDark: "rgb(var(--ha-success))",
    successLight: "var(--ha-success-light)",
    textPrimary: "rgb(var(--ha-text))",
    textSecondary: "rgb(var(--ha-text-secondary))",
    textTertiary: "rgb(var(--ha-text-muted))",
    background: "rgb(var(--ha-bg))",
    backgroundSoft: "rgb(var(--ha-surface))",
    inputBackground: "rgb(var(--ha-input-bg))",
    border: "rgb(var(--ha-card-border))",
    cardBackground: "rgb(var(--ha-card))",
  },
} as const;

export type ThemeColors = typeof theme.colors;
