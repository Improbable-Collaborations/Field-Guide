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
})
