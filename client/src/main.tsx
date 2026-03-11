import { createRoot } from "react-dom/client";
import "./index.css";

const KNOWN_ROUTES = [
  "/", "/login", "/signup", "/auth/callback", "/onboarding-embed",
  "/continue", "/onboarding", "/paywall", "/dashboard",
  "/subscription-success", "/impressum", "/datenschutz", "/terms",
  "/admin/ingestion",
];

const KNOWN_PREFIXES = [
  "/onboarding/", "/dashboard/", "/settings/", "/listing/",
  "/application-letter", "/profile/", "/tips/", "/account/",
];

function isKnownRoute(path: string): boolean {
  if (KNOWN_ROUTES.includes(path)) return true;
  return KNOWN_PREFIXES.some((p) => path.startsWith(p));
}

function isNative(): boolean {
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}

function normalizeNativePath() {
  const path = window.location.pathname;
  const href = window.location.href;

  console.log("[HousAlert] startup path:", path, "href:", href, "native:", isNative());

  if (!isKnownRoute(path)) {
    console.log("[HousAlert] unknown path, normalizing to /");
    window.history.replaceState(null, "", "/");
  }
}

function renderError(err: unknown) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:32px;font-family:system-ui;color:#333;text-align:center;">
      <h2>App konnte nicht geladen werden</h2>
      <p style="color:#888;font-size:14px;margin-top:12px;">${err instanceof Error ? err.message : "Unbekannter Fehler"}</p>
      <p style="color:#aaa;font-size:12px;margin-top:8px;">path: ${window.location.pathname}<br/>href: ${window.location.href}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;border-radius:8px;background:#2DD4BF;color:#fff;border:none;font-size:16px;">Erneut versuchen</button>
    </div>`;
  }
}

async function bootstrap() {
  try {
    normalizeNativePath();

    try {
      const { restoreAuthFromNative } = await import("./lib/capacitor-storage");
      await restoreAuthFromNative();
    } catch {}

    try {
      const { initCapacitorPlugins } = await import("./lib/capacitor");
      await initCapacitorPlugins();
    } catch {}

    const { default: App } = await import("./App");
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (err) {
    console.error("[HousAlert] Bootstrap failed:", err);
    renderError(err);
  }
}

bootstrap();
