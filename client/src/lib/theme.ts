export const theme = {
  colors: {
    primary: "#673DE5",
    primaryHover: "#5B30D6",
    iconBackground: "#DCDBFA",
    neon: "#CBFF02",
    darkLabel: "#110C29",
    purpleLabel: "#471EA7",
    textPrimary: "#111827",
    textSecondary: "#6B7280",
    background: "#FFFFFF",
    backgroundSoft: "#F8FAFC",
    inputBackground: "#F3F4F6",
    border: "#E5E7EB",
    cardBackground: "#FFFFFF",
  },
} as const;

export type ThemeColors = typeof theme.colors;
