import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path for GitHub Pages project sites. Set VITE_BASE at build time:
//   VITE_BASE=/your-repo-name/ npm run build
// or leave unset for a user/org site served at /.
declare const process: { env: Record<string, string | undefined> };
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  plugins: [react()],
  base,
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // Pyodide ships its own runtime and shouldn't be prebundled.
    exclude: ["pyodide"],
  },
  build: {
    target: "es2020",
  },
});
