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
