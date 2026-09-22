import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Proxy all /api/* and /uploads/* requests to the backend during dev
      "/api": {
        target: "https://www.themasterserp.com",
        changeOrigin: true,
      },
      "/uploads": {
        target: "https://www.themasterserp.com",
        changeOrigin: true,
      },
    },
  },
});
