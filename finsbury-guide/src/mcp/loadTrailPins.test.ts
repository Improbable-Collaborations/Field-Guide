import { describe, expect, it } from "vitest"
import { PLACES } from "../places"
import { trailPinsFromFeatureCollection, loadAuthoredTrailPins } from "./loadTrailPins"

describe("authored trail pins", () => {
  it("reads JAB SW1 glove narration from GeoJSON", () => {
    const pins = loadAuthoredTrailPins(PLACES)
    const door = pins.find((p) => p.id === "glove-victoria-door")
    expect(door?.title).toBe("Club door mitt")
    expect(door?.narrationText).toMatch(/pavement outside the club door/)
    expect(door?.directionHint).toMatch(/Colonnade Walk/)
  })

  it("skips features without an id", () => {
    expect(
      trailPinsFromFeatureCollection({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { title: "no" }, geometry: { coordinates: [0, 1] } }],
      }),
    ).toEqual([])
  })
})
