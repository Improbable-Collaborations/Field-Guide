import { describe, expect, it } from "vitest"
import { claudeConnectorLink } from "../mcp/connectLinks"
import { publicMcpUrl } from "../mcp/origin"

describe("personal AI connect links", () => {
  it("pre-fills Claude's add-connector dialog with the shared Field Guide MCP URL", () => {
    const mcp = publicMcpUrl("https://guide.example")
    expect(mcp).toBe("https://guide.example/mcp")
    const link = claudeConnectorLink(mcp)
    const u = new URL(link)
    expect(u.origin + u.pathname).toBe("https://claude.ai/customize/connectors")
    expect(u.searchParams.get("connectorUrl")).toBe(mcp)
  })
})
