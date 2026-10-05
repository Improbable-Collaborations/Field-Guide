import { describe, expect, it } from "vitest"
import { geojsonFromToolResult } from "./geojsonFromToolResult"

const fc = { type: "FeatureCollection" as const, features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }] }

describe("geojsonFromToolResult", () => {
  it("reads structuredContent.geojson from a tool result", () => {
    expect(geojsonFromToolResult({ structuredContent: { layer: "ra", geojson: fc } })).toBe(fc)
  })

  it("reads window.openai.toolOutput after a late host bind", () => {
    expect(geojsonFromToolResult(null, { toolOutput: { layer: "ra", geojson: fc } })).toBe(fc)
  })

  it("reads a FeatureCollection posted as the notification params", () => {
    expect(geojsonFromToolResult(fc)).toBe(fc)
  })
})
