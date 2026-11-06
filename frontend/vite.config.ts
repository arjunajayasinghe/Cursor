import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Allow Cursor / tunnel Host headers so localhost:5173 forwarding works.
    allowedHosts: true,
    // Same-origin /api so Cursor localhost:5173 works without a separate :8080 tunnel.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/hangfire": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});

