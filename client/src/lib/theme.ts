export const theme = {
  colors: {
    primary: "#0D6EFD",
    primaryHover: "#0B5ED7",
    primaryLight: "#EBF2FF",
    iconBackground: "#EBF2FF",
    neon: "#CBFF02",
    darkLabel: "#111C3D",
    successMain: "#22C55E",
    successDark: "#16A34A",
    successLight: "#F0FDF4",
    textPrimary: "#222222",
    textSecondary: "#717171",
    textTertiary: "#B0B0B0",
    background: "#FFFFFF",
    backgroundSoft: "#F8FAFC",
    inputBackground: "#F3F4F6",
    border: "#E5E7EB",
    cardBackground: "#FFFFFF",
  },
} as const;

export type ThemeColors = typeof theme.colors;
