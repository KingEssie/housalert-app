import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initCapacitorPlugins } from "./lib/capacitor";

initCapacitorPlugins();

createRoot(document.getElementById("root")!).render(<App />);
