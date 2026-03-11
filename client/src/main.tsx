import { createRoot } from "react-dom/client";
import "./index.css";
import { initCapacitorPlugins } from "./lib/capacitor";
import { restoreAuthFromNative } from "./lib/capacitor-storage";

async function bootstrap() {
  await restoreAuthFromNative();
  initCapacitorPlugins();
  const { default: App } = await import("./App");
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
