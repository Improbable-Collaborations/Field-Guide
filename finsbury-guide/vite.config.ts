import { defineConfig, type ProxyOptions } from "vite"

const skiddleProxy: ProxyOptions = {
  target: "https://www.skiddle.com",
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(/^\/api\/skiddle/, ""),
}

const raProxy: ProxyOptions = {
  target: "https://ra.co",
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(/^\/api\/ra/, ""),
  configure: (proxy) => {
    proxy.on("proxyReq", (proxyReq) => {
      proxyReq.setHeader("Origin", "https://ra.co")
      proxyReq.setHeader("Referer", "https://ra.co/events/uk/london")
      proxyReq.setHeader(
        "User-Agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      )
    })
  },
}

export default defineConfig({
  server: {
    port: 5179,
    open: false,
    proxy: {
      "/api/skiddle": skiddleProxy,
      "/api/ra": raProxy,
    },
  },
  preview: {
    port: 5179,
    proxy: {
      "/api/skiddle": skiddleProxy,
      "/api/ra": raProxy,
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
})
