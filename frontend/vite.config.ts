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

// On "/" only, fetches the lazy landing chunk and its imports alongside the entry bundle instead of after it.
// Without this the landing page waits for the entry to run before its own chunk is requested (mobile LCP).
function landingPreload(): Plugin {
  return {
    name: "landing-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const chunks = Object.values(ctx.bundle ?? {}).filter((c) => c.type === "chunk");
        const landing = chunks.find((c) => c.facadeModuleId?.endsWith("/pages/public/LandingPage.tsx"));
        if (!landing) return [];
        const files = new Set<string>();
        const visit = (fileName: string) => {
          if (files.has(fileName)) return;
          files.add(fileName);
          chunks.find((c) => c.fileName === fileName)?.imports.forEach(visit);
        };
        visit(landing.fileName);
        const script = `if(location.pathname==="/")for(const f of ${JSON.stringify([...files])}){const l=document.createElement("link");l.rel="modulepreload";l.href="/"+f;document.head.appendChild(l)}`;
        return [{ tag: "script", children: script, injectTo: "head" }];
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    apiPreconnect(loadEnv(mode, process.cwd(), "").VITE_API_URL),
    landingPreload(),
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
