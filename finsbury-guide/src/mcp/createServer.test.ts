import { describe, expect, it } from "vitest"
import { fieldGuideTools } from "./createServer"
import { MAP_WIDGET_MIME, MAP_WIDGET_URI } from "./mapWidget"

describe("Field Guide MCP tools", () => {
  it("keeps data tools separate from the map widget", () => {
    const map = fieldGuideTools().find((t) => t.name === "field_guide_map")
    expect(map?.inputSchema.required).toEqual(["layer"])
    expect(map?.inputSchema.properties.layer.enum).toEqual(["ra", "gig", "nearby", "trail", "place", "personal"])
    expect(map?._meta?.ui?.resourceUri).toBeUndefined()
  })

  it("associates field_guide_render_map with the map widget", () => {
    const render = fieldGuideTools().find((t) => t.name === "field_guide_render_map")
    expect(render?._meta?.ui?.resourceUri).toBe(MAP_WIDGET_URI)
    expect(render?._meta?.["openai/outputTemplate"]).toBe(MAP_WIDGET_URI)
    expect(MAP_WIDGET_MIME).toBe("text/html;profile=mcp-app")
  })

  it("exposes Look and check-in for ChatGPT on a phone", () => {
    const look = fieldGuideTools().find((t) => t.name === "field_guide_look")
    const check = fieldGuideTools().find((t) => t.name === "field_guide_check_in")
    expect(look?._meta?.ui?.resourceUri).toBe("ui://field-guide/look/v3.html")
    const sit = fieldGuideTools().find((t) => t.name === "field_guide_sit")
    expect(sit?._meta?.ui?.resourceUri).toBe("ui://field-guide/sit/v1.html")
    expect(check?.inputSchema.properties.dwellSeconds).toBeDefined()
    expect(check?.description).toMatch(/I'm here/)
    const wallet = fieldGuideTools().find((t) => t.name === "field_guide_wallet")
    expect(wallet).toBeDefined()
    expect(wallet?.inputSchema.properties.includeNfts).toBeDefined()
    expect(wallet?.inputSchema.properties.includeFieldGuide).toBeDefined()
    expect(wallet?.inputSchema.properties.avatarId).toBeUndefined()
    expect(wallet?.inputSchema.properties.address).toBeUndefined()
    expect(wallet?.description).toMatch(/Dedicated OASIS Solana wallet/)
    expect(wallet?.description).toMatch(/no wallet_balance/)
    const open = fieldGuideTools().find((t) => t.name === "field_guide_open_look")
    expect(open?.description).toMatch(/already-open/)
  })
})
