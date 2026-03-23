import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const version =
      typeof __SW_VERSION__ === "string" && __SW_VERSION__.trim()
        ? __SW_VERSION__.trim()
        : "dev";
    const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(version)}`;

    navigator.serviceWorker.register(serviceWorkerUrl).catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
