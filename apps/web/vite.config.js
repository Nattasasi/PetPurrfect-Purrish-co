import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  // onnxruntime-web's internal dynamic import of its WASM loader breaks when
  // esbuild pre-bundles/rewrites it; excluding it keeps that import intact.
  optimizeDeps: {
    exclude: ["onnxruntime-web"]
  }
});
