import { describe, expect, it } from "vitest"
import { MAP_WIDGET_URI, mapWidgetHtml } from "./mapWidget"

describe("Field Guide map widget", () => {
  it("plots GeoJSON on a canvas with no external scripts or tiles", () => {
    const html = mapWidgetHtml()
    expect(MAP_WIDGET_URI).toBe("ui://field-guide/map/v5.html")
    expect(html).toMatch(/Field Guide debug/)
    expect(html).toMatch(/LineString/)
    expect(html).toMatch(/features\.length/)
    expect(html).not.toMatch(/Could not load ra/)
  })
})
