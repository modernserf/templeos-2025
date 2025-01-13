import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { DBProvider, runtime } from "./state.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DBProvider value={runtime}>
      <App />
    </DBProvider>
  </StrictMode>
);
