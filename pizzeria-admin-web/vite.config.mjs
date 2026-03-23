import path from "node:path";
import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const sharedSrcPath = path.resolve(__dirname, "../pizzeria-web-service-front/src");
const adminNodeModulesPath = path.resolve(__dirname, "node_modules");

export default defineConfig({
  plugins: [
    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        if (!/\/src\/.*\.js$/.test(id.replaceAll("\\", "/"))) return null;

        return transformWithEsbuild(code, id, {
          loader: "jsx",
          jsx: "automatic",
        });
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@shared": sharedSrcPath,
      react: path.resolve(adminNodeModulesPath, "react"),
      "react/jsx-runtime": path.resolve(adminNodeModulesPath, "react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(adminNodeModulesPath, "react/jsx-dev-runtime.js"),
      "react-dom": path.resolve(adminNodeModulesPath, "react-dom"),
      "react-router-dom": path.resolve(adminNodeModulesPath, "react-router-dom"),
      axios: path.resolve(adminNodeModulesPath, "axios"),
      "react-helmet-async": path.resolve(adminNodeModulesPath, "react-helmet-async"),
    },
    dedupe: ["react", "react-dom", "react-router-dom", "axios", "react-helmet-async"],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
});
