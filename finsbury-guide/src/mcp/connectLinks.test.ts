import { describe, expect, it } from "vitest"
import { claudeConnectorLink, publicMcpUrl } from "../mcp/connectLinks"

describe("personal AI connect links", () => {
  it("pre-fills Claude's add-connector dialog with the Field Guide MCP URL", () => {
    const mcp = publicMcpUrl("https://guide.example", "ticket-1")
    expect(mcp).toBe("https://guide.example/mcp/ticket-1")
    const link = claudeConnectorLink(mcp)
    const u = new URL(link)
    expect(u.origin + u.pathname).toBe("https://claude.ai/customize/connectors")
    expect(u.searchParams.get("modal")).toBe("add-custom-connector")
    expect(u.searchParams.get("connectorName")).toBe("Field Guide")
    expect(u.searchParams.get("connectorUrl")).toBe(mcp)
  })
})
