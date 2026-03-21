import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/mixpanel";

// OpenTelemetry disabled due to Vercel compatibility
// import('./tracing').then(({ initTracing }) => initTracing());

createRoot(document.getElementById("root")!).render(<App />);
