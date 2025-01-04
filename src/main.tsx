import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { DBProvider, database } from "./state.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DBProvider value={database}>
      <App />
    </DBProvider>
  </StrictMode>
);
