import { describe, expect, it } from "vitest"
import { LOOK_WIDGET_URI, lookWidgetHtml } from "./lookWidget"

describe("Look widget", () => {
  it("uses MCP Apps tools/call so I'm here works without window.openai.callTool", () => {
    expect(LOOK_WIDGET_URI).toBe("ui://field-guide/look/v3.html")
    const html = lookWidgetHtml()
    expect(html).toMatch(/tools\/call/)
    expect(html).toMatch(/field_guide_check_in/)
    expect(html).not.toMatch(/getUserMedia/)
  })
})
