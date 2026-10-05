import { describe, expect, it } from "vitest"
import { PLACES } from "../places"
import { JAB_SW1_GLOVES_PLACE_ID } from "../quests/jabSw1Gloves"
import { buildFieldGuideMap } from "./mapGeojson"

describe("Field Guide map GeoJSON", () => {
  it("rehydrates the JAB SW1 gloves from the authored trail file", () => {
    const map = buildFieldGuideMap({
      places: PLACES,
      collectedIds: ["glove-victoria-door"],
      placeId: JAB_SW1_GLOVES_PLACE_ID,
    })
    expect(map.type).toBe("FeatureCollection")
    const door = map.features.find((f) => f.properties.id === "glove-victoria-door")
    expect(door?.geometry.type).toBe("Point")
    if (door?.geometry.type !== "Point") throw new Error("expected Point")
    expect(door.geometry.coordinates[0]).toBeCloseTo(-0.14726, 4)
    expect(door.geometry.coordinates[1]).toBeCloseTo(51.49274, 4)
    expect(door?.properties.collected).toBe(true)
    expect(door?.properties.title).toMatch(/door|mitt|Club/i)
    const venue = map.features.find((f) => f.properties.id === JAB_SW1_GLOVES_PLACE_ID)
    expect(venue?.properties.source).toBe("place")
    expect(map.features.some((f) => f.properties.id === "finsbury-park")).toBe(false)
  })

  it("includes the Finsbury Park Circuit walk LineString", () => {
    const map = buildFieldGuideMap({
      places: PLACES,
      placeId: "trail-finsbury-park-circuit",
      layer: "trail",
    })
    const walk = map.features.find((f) => f.properties.id === "park-circuit-walk")
    expect(walk?.geometry.type).toBe("LineString")
    expect(walk?.properties.kind).toBe("walk")
    expect(walk?.properties.pinIds).toContain("park-manor-house-gate")
    const coords = walk?.geometry.type === "LineString" ? walk.geometry.coordinates : []
    expect(coords.length).toBeGreaterThan(5)
    expect(coords.every((c) => c[1] > 51.567 && c[1] < 51.575 && c[0] < -0.096 && c[0] > -0.105)).toBe(true)
  })

  it("adds this avatar's photos as source personal", () => {
    const map = buildFieldGuideMap({
      places: PLACES.filter((p) => p.id === JAB_SW1_GLOVES_PLACE_ID),
      placeId: JAB_SW1_GLOVES_PLACE_ID,
      personalPhotos: [
        {
          id: "photo-1",
          lon: -0.147,
          lat: 51.493,
          caption: "Mitt light",
          imageUrl: "https://example.com/p.jpg",
          pinId: "glove-victoria-door",
          placeId: JAB_SW1_GLOVES_PLACE_ID,
        },
      ],
    })
    const personal = map.features.find((f) => f.properties.source === "personal")
    expect(personal?.geometry.type).toBe("Point")
    if (personal?.geometry.type !== "Point") throw new Error("expected Point")
    expect(personal.geometry.coordinates[0]).toBeCloseTo(-0.147, 3)
    expect(personal?.properties.imageUrl).toBe("https://example.com/p.jpg")
  })

  it("lists RA, gigs, and STAR nearby as their own sources", () => {
    const map = buildFieldGuideMap({
      places: PLACES.filter((p) => p.id === JAB_SW1_GLOVES_PLACE_ID),
      placeId: JAB_SW1_GLOVES_PLACE_ID,
      raEvents: [
        {
          id: "ra-1",
          title: "Fabric",
          venueName: "Fabric",
          startDate: "2026-10-04T22:00:00.000Z",
          url: "https://ra.co/events/1",
          lng: -0.1024,
          lat: 51.5195,
          artists: ["A"],
          genres: ["techno"],
        },
      ],
      gigs: [
        {
          id: "https://www.skiddle.com/e/1",
          name: "Nambucca",
          venueName: "Nambucca",
          startDate: "2026-10-04T19:00:00.000Z",
          url: "https://www.skiddle.com/e/1",
          lng: -0.12,
          lat: 51.56,
        },
      ],
      nearby: [{ id: "star-pin", title: "Live drop", lon: -0.1, lat: 51.57 } as never],
    })
    expect(map.layerCounts.ra).toBe(1)
    expect(map.layerCounts.gig).toBe(1)
    expect(map.layerCounts.nearby).toBe(1)
    expect(map.features.find((f) => f.properties.source === "ra")?.properties.title).toBe("Fabric")
    const raOnly = buildFieldGuideMap({
      places: PLACES.filter((p) => p.id === JAB_SW1_GLOVES_PLACE_ID),
      placeId: JAB_SW1_GLOVES_PLACE_ID,
      layer: "ra",
      raEvents: [
        {
          id: "ra-1",
          title: "Fabric",
          venueName: "Fabric",
          startDate: "2026-10-04T22:00:00.000Z",
          url: "https://ra.co/events/1",
          lng: -0.1024,
          lat: 51.5195,
          artists: ["A"],
          genres: ["techno"],
        },
      ],
    })
    expect(raOnly.features.every((f) => f.properties.source === "ra")).toBe(true)
    expect(raOnly.layerCounts.place).toBeUndefined()
  })

  it("rejects an unknown place", () => {
    expect(() => buildFieldGuideMap({ places: PLACES, placeId: "not-a-place" })).toThrow(/Unknown placeId/)
  })
})
