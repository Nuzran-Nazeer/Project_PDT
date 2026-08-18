import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Tailwind v4 runs as a Vite plugin. There is no tailwind.config.js and no
  // postcss.config.js — the plugin scans the source files itself and the theme
  // is configured in CSS (see src/index.css).
  plugins: [react(), tailwindcss()],
});
