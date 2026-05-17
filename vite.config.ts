import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // envDir must point to the project root (where .env lives), NOT to the
  // Vite root ("client/"). Without this, Vite looks for .env in client/ and
  // never finds it, so import.meta.env.VITE_* stays undefined in the bundle.
  envDir: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // No manualChunks — Vite default splits only lazily-imported routes.
    // Splitting vendor libs into separate files caused a sequential waterfall
    // on Android WebView (each file = one asset-loader round-trip before App.js
    // can execute) and more than doubled cold-start time on Samsung devices.
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
