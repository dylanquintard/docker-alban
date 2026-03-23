import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

function asyncCssLinkPlugin() {
  return {
    name: "async-css-link",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet"([^>]*?)href="([^"]+)"([^>]*)>/g,
        (_match, beforeHref = "", href = "", afterHref = "") => {
          const trailingAttributes = `${beforeHref}${afterHref}`.replace(
            /\s+onload="[^"]*"/g,
            ""
          );

          return [
            `<link rel="preload" as="style" href="${href}"${trailingAttributes} onload="this.onload=null;this.rel='stylesheet'">`,
            `<noscript><link rel="stylesheet" href="${href}"${trailingAttributes}></noscript>`,
          ].join("");
        }
      );
    },
  };
}

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
    asyncCssLinkPlugin(),
    react(),
  ],
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
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/**/*.{test,spec}.{js,jsx}"],
    },
  },
});
