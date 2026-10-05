import type { Request } from "express"

export function publicOrigin(req: Request): string {
  const env = (process.env.FIELD_GUIDE_PUBLIC_ORIGIN || "").replace(/\/$/, "")
  if (env) return env
  const headerOrigin = (req.header("x-public-origin") || "").replace(/\/$/, "")
  if (headerOrigin.startsWith("http://") || headerOrigin.startsWith("https://")) return headerOrigin
  const proto = (req.header("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim()
  const host = (req.header("x-forwarded-host") || req.header("host") || "127.0.0.1:8788").split(",")[0].trim()
  return `${proto}://${host}`
}

/** One connector URL for the life of the host. Never bump this to refresh ChatGPT tool cache. */
export const MCP_PATH = "/mcp"

/** Older ChatGPT connectors we already handed out. Same server, same tools. */
export const MCP_PATH_ALIASES = ["/mcp", "/mcp/map-layers", "/mcp/map-ui"] as const

export function publicMcpUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${MCP_PATH}`
}

const PROTECTED_RESOURCE_WELL_KNOWN = "/.well-known/oauth-protected-resource"

/** RFC 9728: metadata under /.well-known/.../<resource-path> names that resource. */
export function mcpPathFromWellKnown(requestPath: string): string {
  const path = requestPath.split("?")[0]
  if (path.startsWith(`${PROTECTED_RESOURCE_WELL_KNOWN}/`)) {
    const suffix = `/${path.slice(PROTECTED_RESOURCE_WELL_KNOWN.length + 1)}`
    if ((MCP_PATH_ALIASES as readonly string[]).includes(suffix)) return suffix
  }
  return MCP_PATH
}
