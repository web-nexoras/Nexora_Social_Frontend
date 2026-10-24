import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const configuredApiUrl = env.VITE_API_URL || "http://localhost:5000/api/v1";
  let apiTarget = "http://localhost:5000";
  try {
    apiTarget = new URL(configuredApiUrl).origin;
  } catch {
    // Keep the local backend target if the configured URL is invalid.
  }

  return {
    plugins: [react()],
    // Pre-bundle every dependency up front. Without this Vite discovers the
    // deps that only lazy pages import (react-icons, socket.io, auth0) lazily
    // on the first request, which stalls the first page load and then forces a
    // full page reload ("new dependencies optimized") — the app restarts and
    // the user watches the loader twice before reaching Sign In.
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-router-dom",
        "axios",
        "socket.io-client",
        "@auth0/auth0-react",
        "react-icons/fi",
        "react-icons/lu",
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("/@auth0/") || id.includes("/jose/")) return "auth-vendor";
            if (id.includes("/react-icons/")) return "icons-vendor";
            if (id.includes("/socket.io-") || id.includes("/engine.io-") || id.includes("/ws/")) {
              return "socket-vendor";
            }
            if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
              return "react-vendor";
            }
            if (id.includes("/react-router") || id.includes("/@remix-run/")) return "router-vendor";
            if (id.includes("/axios/")) return "http-vendor";
          },
        },
      },
    },
    server: {
      port: 3000,
      host: true,
      // Transform the entry + the first routes as soon as the server boots, in
      // the background. The browser then receives already-compiled modules
      // instead of waiting for Vite to compile them on demand.
      warmup: {
        clientFiles: [
          "./src/main.jsx",
          "./src/App.jsx",
          "./src/components/DashboardShell.jsx",
          "./src/pages/Home.jsx",
          "./src/pages/Login.jsx",
        ],
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/socket.io": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
