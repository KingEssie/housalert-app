import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"], // kept for shadcn compatibility, but no .dark class is ever applied
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem", /* 9px */
        md: ".375rem", /* 6px */
        sm: ".1875rem", /* 3px */
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
        ha: {
          bg: "rgb(var(--ha-bg) / <alpha-value>)",
          card: "rgb(var(--ha-card) / <alpha-value>)",
          "card-border": "rgb(var(--ha-card-border) / <alpha-value>)",
          "card-hover": "rgb(var(--ha-card-hover) / <alpha-value>)",
          text: "rgb(var(--ha-text) / <alpha-value>)",
          "text-secondary": "rgb(var(--ha-text-secondary) / <alpha-value>)",
          "text-muted": "rgb(var(--ha-text-muted) / <alpha-value>)",
          primary: "rgb(var(--ha-primary) / <alpha-value>)",
          "primary-hover": "rgb(var(--ha-primary-hover) / <alpha-value>)",
          "primary-light": "var(--ha-primary-light)",
          "input-bg": "rgb(var(--ha-input-bg) / <alpha-value>)",
          "input-border": "rgb(var(--ha-input-border) / <alpha-value>)",
          surface: "rgb(var(--ha-surface) / <alpha-value>)",
          "nav-bg": "rgb(var(--ha-nav-bg) / <alpha-value>)",
          "nav-border": "rgb(var(--ha-nav-border) / <alpha-value>)",
          success: "rgb(var(--ha-success) / <alpha-value>)",
          "success-light": "var(--ha-success-light)",
          warning: "rgb(var(--ha-warning) / <alpha-value>)",
          "warning-light": "var(--ha-warning-light)",
          danger: "rgb(var(--ha-danger) / <alpha-value>)",
          "danger-light": "var(--ha-danger-light)",
          "icon-secondary": "rgb(var(--ha-icon-secondary) / <alpha-value>)",
          "badge-bg": "rgb(var(--ha-badge-bg) / <alpha-value>)",
          "status-green": "rgb(var(--ha-status-green) / <alpha-value>)",
          "status-red": "rgb(var(--ha-status-red) / <alpha-value>)",
          "avatar-purple": "rgb(var(--ha-avatar-purple) / <alpha-value>)",
          "surface-active": "rgb(var(--ha-surface-active) / <alpha-value>)",
          "surface-hover": "rgb(var(--ha-surface-hover) / <alpha-value>)",
          "divider": "rgb(var(--ha-divider) / <alpha-value>)",
          "profile-header": "rgb(var(--ha-profile-header) / <alpha-value>)",
          "brand-dark": "rgb(var(--ha-brand-dark) / <alpha-value>)",
          "brand-dark-hover": "rgb(var(--ha-brand-dark-hover) / <alpha-value>)",
          "brand-dark-border": "rgb(var(--ha-brand-dark-border) / <alpha-value>)",
        },
      },
      boxShadow: {
        "ha-card": "var(--ha-shadow-card)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "scaleIn": {
          from: { transform: "scale(0.5)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "scale-in": "scaleIn 0.5s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
