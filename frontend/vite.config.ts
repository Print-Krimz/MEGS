import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Opens the connection to an absolute API origin before any JavaScript runs.
function apiPreconnect(apiUrl: string | undefined): Plugin {
  return {
    name: "api-preconnect",
    transformIndexHtml() {
      if (!apiUrl || !/^https?:\/\//i.test(apiUrl.trim())) return [];
      const origin = new URL(apiUrl.trim()).origin;
      return [{ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: true }, injectTo: "head-prepend" }];
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    apiPreconnect(loadEnv(mode, process.cwd(), "").VITE_API_URL),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
}));
