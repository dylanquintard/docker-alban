import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const serviceWorkerVersion = process.env.VITE_SW_VERSION || new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __SW_VERSION__: JSON.stringify(serviceWorkerVersion),
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.js", "src/**/*.jsx"],
      exclude: ["src/main.jsx"],
    },
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
});
