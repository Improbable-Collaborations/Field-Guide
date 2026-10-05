import { describe, expect, it } from "vitest"
import { MCP_PATH, mcpPathFromWellKnown, publicMcpUrl } from "./origin"

describe("Field Guide MCP origin", () => {
  it("advertises one stable /mcp URL", () => {
    expect(MCP_PATH).toBe("/mcp")
    expect(publicMcpUrl("https://annabella.example")).toBe("https://annabella.example/mcp")
  })

  it("keeps older connector paths as the same resource identity ChatGPT already stored", () => {
    expect(mcpPathFromWellKnown("/.well-known/oauth-protected-resource")).toBe("/mcp")
    expect(mcpPathFromWellKnown("/.well-known/oauth-protected-resource/mcp/map-ui")).toBe("/mcp/map-ui")
    expect(mcpPathFromWellKnown("/.well-known/oauth-protected-resource/mcp/map-layers")).toBe("/mcp/map-layers")
  })
})
