import { createRoot } from "react-dom/client";
import "./index.css";

function isCapacitorNative(): boolean {
  return typeof (window as any).Capacitor !== "undefined" &&
    (window as any).Capacitor.isNativePlatform?.() === true;
}

function waitForCapacitorBridge(timeout = 3000): Promise<void> {
  if (!isCapacitorNative()) return Promise.resolve();
  if (typeof (window as any).Capacitor?.triggerEvent === "function") return Promise.resolve();

  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (typeof (window as any).Capacitor?.triggerEvent === "function" || Date.now() - start > timeout) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

async function bootstrap() {
  await waitForCapacitorBridge();

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
}

bootstrap();
