import { createRoot } from "react-dom/client";
import "./index.css";
import "mapbox-gl/dist/mapbox-gl.css";

function renderError(err: unknown) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:32px;font-family:system-ui;color:#111111;text-align:center;">
      <h2>App konnte nicht geladen werden</h2>
      <p style="color:#334855;font-size:14px;margin-top:12px;">${err instanceof Error ? err.message : "Unbekannter Fehler"}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;border-radius:6px;background:rgb(var(--ha-primary));color:#fff;border:none;font-size:16px;">Erneut versuchen</button>
    </div>`;
  }
}

function isNative(): boolean {
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.() === true) return true;
  if (w.__HOUSALERT_NATIVE__ === true) return true;
  try {
    if (new URLSearchParams(window.location.search).get("native") === "1") return true;
  } catch {}
  return false;
}

function normalizeHashPaths() {
  if (isNative()) return false;
  const hash = window.location.hash;
  if (hash && hash.startsWith("#/onboarding")) {
    const hashPath = hash.slice(1);
    const newUrl = window.location.origin + hashPath;
    window.location.replace(newUrl);
    return true;
  }
  return false;
}

async function bootstrap() {
  if (normalizeHashPaths()) return;
  try {
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
