import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    // Stable, readable output names: assets/app.css + assets/app.js
    // (instead of hashed names like index-BDxeZrA-.css)
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (info) => {
          const name = (info.names && info.names[0]) || info.name || "";
          if (name.endsWith(".css")) return "assets/app.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
