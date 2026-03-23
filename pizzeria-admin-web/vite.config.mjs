import path from "node:path";
import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const sharedSrcPath = path.resolve(__dirname, "../pizzeria-web-service-front/src");

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
    },
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
