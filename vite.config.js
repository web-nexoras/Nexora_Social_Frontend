import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
