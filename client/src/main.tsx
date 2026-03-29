import { createRoot } from "react-dom/client";
import "./index.css";

function renderError(err: unknown) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:32px;font-family:system-ui;color:#222222;text-align:center;">
      <h2>App konnte nicht geladen werden</h2>
      <p style="color:#717171;font-size:14px;margin-top:12px;">${err instanceof Error ? err.message : "Unbekannter Fehler"}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;border-radius:6px;background:#e91e63;color:#fff;border:none;font-size:16px;">Erneut versuchen</button>
    </div>`;
  }
}

function redirectNonHashPaths() {
  const path = window.location.pathname;
  if (path.startsWith("/onboarding/") || path === "/onboarding") {
    const qs = window.location.search;
    window.location.replace("/#" + path + qs);
    return true;
  }
  return false;
}

async function bootstrap() {
  if (redirectNonHashPaths()) return;
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
