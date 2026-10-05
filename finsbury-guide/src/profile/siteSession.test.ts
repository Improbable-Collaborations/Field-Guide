import { describe, expect, it } from "vitest"
import { parseSiteView, formatLiveSiteLine } from "./siteSession"

describe("live Field Guide tab presence", () => {
  it("parses what the visitor is looking at", () => {
    const view = parseSiteView({
      mode: "you",
      selectedPlaceId: "trail-jab-sw1-gloves",
      selectedPinId: "glove-victoria-door",
      wearingPersonaId: "alex",
      wearingClusterId: "boxing",
    })
    expect(view).toMatchObject({ mode: "you", selectedPinId: "glove-victoria-door" })
    expect(formatLiveSiteLine(view as Exclude<typeof view, string>)).toMatch(/you · wearing alex/)
  })

  it("includes live GPS when the Walk tab is sending a fix", () => {
    const view = parseSiteView({
      mode: "walk",
      selectedPlaceId: "trail-finsbury-park-circuit",
      lat: 51.5714,
      lon: -0.0998,
      accuracyM: 12,
    })
    expect(formatLiveSiteLine(view as Exclude<typeof view, string>)).toMatch(/GPS 51\.57140, -0\.09980 ±12m/)
  })
})
