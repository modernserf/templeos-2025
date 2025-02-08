import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./view_primitive.tsx";
import { clearState } from "./storage.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <button style={{ marginTop: "1rem" }} onClick={clearState}>
      Clear state
    </button>
  </StrictMode>,
);
