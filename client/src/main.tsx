import { createRoot } from "react-dom/client";
import "./index.css";

function renderError(err: unknown) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:32px;font-family:system-ui;color:#222222;text-align:center;">
      <h2>App konnte nicht geladen werden</h2>
      <p style="color:#717171;font-size:14px;margin-top:12px;">${err instanceof Error ? err.message : "Unbekannter Fehler"}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;border-radius:8px;background:#0D6EFD;color:#fff;border:none;font-size:16px;">Erneut versuchen</button>
    </div>`;
  }
}

async function bootstrap() {
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
