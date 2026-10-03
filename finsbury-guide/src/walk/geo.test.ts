import { describe, expect, it } from "vitest"
import type { TrailPin } from "field-guide-web4-client"
import {
  DESK_MAP_PITCH,
  DESK_MAP_ZOOM,
  WALK_STREET_PITCH,
  WALK_STREET_ZOOM,
  deskWalkRequested,
  geoFixFromCoords,
  haversineMeters,
  insidePinRadius,
  lookGloveScale,
  metersToPin,
  nextUncollectedPin,
} from "./geo"

function pin(partial: Partial<TrailPin> & Pick<TrailPin, "id">): TrailPin {
  return {
    title: partial.id,
    lat: 51.49274,
    lon: -0.14726,
    radiusM: 40,
    order: 0,
    questRole: "glove",
    trail: "jab-sw1-gloves",
    wikiSlug: "",
    place: "",
    notes: "",
    narrationText: "",
    directionHint: "",
    audioUrl: "",
    markerStyle: "",
    worldPrefab: "",
    trustOrigin: "",
    peerDisplayName: "",
    peerAvatarId: "",
    trustAudience: "",
    imageUrl: "",
    fileUrl: "",
    dropKind: "glove",
    vaultId: "",
    temperament: "",
    forgeAttestationId: "",
    principalNotionalUsd: 0,
    ...partial,
  }
}

describe("walk geo", () => {
  it("haversine is ~0 at the same point", () => {
    expect(haversineMeters(51.5, -0.1, 51.5, -0.1)).toBeLessThan(0.01)
  })

  it("club door to colonnade is a short street hop", () => {
    const m = haversineMeters(51.49274, -0.14726, 51.49255, -0.14755)
    expect(m).toBeGreaterThan(20)
    expect(m).toBeLessThan(80)
  })

  it("picks the first uncollected pin by order", () => {
    const pins = [
      pin({ id: "b", order: 1 }),
      pin({ id: "a", order: 0 }),
      pin({ id: "c", order: 2 }),
    ]
    expect(nextUncollectedPin(pins, (id) => id === "a")?.id).toBe("b")
    expect(nextUncollectedPin(pins, () => true)).toBeNull()
  })

  it("radius uses pin.radiusM", () => {
    const p = pin({ id: "glove-victoria-door", radiusM: 40 })
    const here = { lat: 51.49274, lon: -0.14726 }
    expect(insidePinRadius(here, p)).toBe(true)
    expect(insidePinRadius({ lat: 51.5, lon: -0.1 }, p)).toBe(false)
    expect(metersToPin(null, p)).toBeNull()
  })

  it("look scale grows as you approach", () => {
    expect(lookGloveScale(200)).toBeLessThan(lookGloveScale(20))
    expect(lookGloveScale(null)).toBe(1)
  })

  it("deskWalk is an explicit query, not a silent default", () => {
    expect(deskWalkRequested("")).toBe(false)
    expect(deskWalkRequested("?deskWalk=1")).toBe(true)
    expect(deskWalkRequested("foo=1")).toBe(false)
  })

  it("walk camera is street scale, not city overview", () => {
    expect(WALK_STREET_ZOOM).toBeGreaterThan(17)
    expect(WALK_STREET_PITCH).toBeGreaterThan(DESK_MAP_PITCH)
    expect(DESK_MAP_ZOOM).toBeLessThan(15)
  })

  it("copies a GeolocationCoordinates-like object into a walk fix", () => {
    const fix = geoFixFromCoords({
      latitude: 51.49274,
      longitude: -0.14726,
      accuracy: 12,
      heading: 90,
    })
    expect(fix.lat).toBe(51.49274)
    expect(fix.lon).toBe(-0.14726)
    expect(fix.accuracyM).toBe(12)
    expect(fix.headingDeg).toBe(90)
    expect(geoFixFromCoords({ latitude: 1, longitude: 2, heading: null }).headingDeg).toBeNull()
  })
})
