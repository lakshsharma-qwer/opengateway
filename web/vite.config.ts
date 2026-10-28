import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API = process.env.OG_API_URL ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": API,
      "/v1": API,
      "/l/": API,
      "/checkout.js": API,
      "/health": API,
    },
  },
  preview: { port: 5173 },
});
