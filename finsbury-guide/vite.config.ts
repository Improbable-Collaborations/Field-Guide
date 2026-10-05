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

const mcpProxy: ProxyOptions = {
  target: "http://127.0.0.1:8788",
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on("proxyReq", (proxyReq, req) => {
      const host = req.headers["x-forwarded-host"] || req.headers.host
      if (typeof host === "string") proxyReq.setHeader("X-Forwarded-Host", host)
      const proto = req.headers["x-forwarded-proto"]
      if (typeof proto === "string") proxyReq.setHeader("X-Forwarded-Proto", proto.split(",")[0].trim())
    })
  },
}

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5179,
    strictPort: true,
    allowedHosts: true,
    open: false,
    proxy: {
      "/api/skiddle": skiddleProxy,
      "/api/ra": raProxy,
      "/mcp": mcpProxy,
      "/connect": mcpProxy,
      "/oauth": mcpProxy,
      "/.well-known": mcpProxy,
    },
  },
  preview: {
    port: 5179,
    proxy: {
      "/api/skiddle": skiddleProxy,
      "/api/ra": raProxy,
      "/mcp": mcpProxy,
      "/connect": mcpProxy,
      "/oauth": mcpProxy,
      "/.well-known": mcpProxy,
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
})
