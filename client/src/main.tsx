import { createRoot } from "react-dom/client";
import "./index.css";
// mapbox-gl CSS is loaded inside map-view-mapbox.tsx (lazy) — do NOT import here.
// Importing it at this level pulled mapbox-gl into the initial bundle and added
// ~2MB of JS that Android V8 had to parse before the app could render.

function renderError(err: unknown) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:32px;font-family:system-ui;color:rgb(var(--ha-text));text-align:center;">
      <h2>App konnte nicht geladen werden</h2>
      <p style="color:rgb(var(--ha-text-secondary));font-size:14px;margin-top:12px;">${err instanceof Error ? err.message : "Unbekannter Fehler"}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;border-radius:6px;background:rgb(var(--ha-primary));color:white;border:none;font-size:16px;">Erneut versuchen</button>
    </div>`;
  }
}

function isNative(): boolean {
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.() === true) {
    try { localStorage.setItem("ha_native_v1", "capacitor"); } catch {}
    return true;
  }
  if (w.__HOUSALERT_NATIVE__ === true) {
    try { if (localStorage.getItem("ha_native_v1") !== "capacitor") localStorage.setItem("ha_native_v1", "expo"); } catch {}
    return true;
  }
  try {
    if (new URLSearchParams(window.location.search).get("native") === "1") {
      // Persist BEFORE any SPA routing strips the query param
      w.__HOUSALERT_NATIVE__ = true;
      try { if (localStorage.getItem("ha_native_v1") !== "capacitor") localStorage.setItem("ha_native_v1", "expo"); } catch {}
      return true;
    }
  } catch {}
  // Android WebView UA marker — React Native / Expo WebView always sets "wv"
  if (/Android.*wv\b/.test(navigator.userAgent)) {
    try { if (localStorage.getItem("ha_native_v1") !== "capacitor") localStorage.setItem("ha_native_v1", "expo"); } catch {}
    return true;
  }
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
  const t0 = performance.now();
  try {
    // Parallelize auth restore + plugin init — neither depends on the other.
    // Previously these were sequential, adding ~500ms to startup on Android.
    await Promise.all([
      import("./lib/capacitor-storage").then(m => m.restoreAuthFromNative()).catch(() => {}),
      import("./lib/capacitor").then(m => m.initCapacitorPlugins()).catch(() => {}),
    ]);
    console.log(`[BOOT] plugins ready in ${Math.round(performance.now() - t0)}ms`);

    const tApp = performance.now();
    const { default: App } = await import("./App");
    console.log(`[BOOT] App chunk loaded in ${Math.round(performance.now() - tApp)}ms`);

    const tRender = performance.now();
    createRoot(document.getElementById("root")!).render(<App />);
    console.log(`[BOOT] first render scheduled in ${Math.round(performance.now() - tRender)}ms — total bootstrap=${Math.round(performance.now() - t0)}ms`);
  } catch (err) {
    console.error("[HousAlert] Bootstrap failed:", err);
    renderError(err);
  }
}

bootstrap();
