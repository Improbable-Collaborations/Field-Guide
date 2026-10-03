import { defineConfig } from "vite"

export default defineConfig({
  server: { port: 5178, open: false },
  preview: { port: 5178 },
  build: { outDir: "dist", emptyOutDir: true },
})
