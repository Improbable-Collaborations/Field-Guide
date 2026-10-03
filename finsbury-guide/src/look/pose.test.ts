import { describe, expect, it } from "vitest"
import type { TrailPin } from "field-guide-web4-client"
import { bearingDegrees, shortestAngleDelta } from "../walk/geo"
import { gloveScreenPose } from "./pose"

function pin(id: string, lat: number, lon: number, radiusM = 40): TrailPin {
  return {
    id,
    title: id,
    lat,
    lon,
    radiusM,
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
  }
}

describe("AR glove pose", () => {
  it("bearing due north is 0", () => {
    expect(bearingDegrees(51.5, -0.1, 51.6, -0.1)).toBeCloseTo(0, 0)
  })

  it("shortest turn to the east is positive", () => {
    expect(shortestAngleDelta(0, 90)).toBe(90)
    expect(shortestAngleDelta(10, 350)).toBe(-20)
  })

  it("glove sits centre when you face the pin", () => {
    const door = pin("glove-victoria-door", 51.493, -0.147)
    const here = { lat: 51.49274, lon: -0.14726 }
    const bearing = bearingDegrees(here.lat, here.lon, door.lat, door.lon)
    const pose = gloveScreenPose(here, bearing, door)
    expect(pose.visible).toBe(true)
    expect(pose.xPct).toBeCloseTo(50, 0)
  })

  it("asks you to turn when the mitt is off-camera", () => {
    const door = pin("glove-victoria-door", 51.493, -0.147)
    const here = { lat: 51.49274, lon: -0.14726 }
    const pose = gloveScreenPose(here, 180, door)
    expect(pose.visible).toBe(false)
    expect(pose.turnHint.startsWith("Turn")).toBe(true)
  })

  it("inRadius is false outside radiusM", () => {
    const door = pin("glove-victoria-door", 51.49274, -0.14726, 40)
    const here = { lat: 51.5, lon: -0.1 }
    const pose = gloveScreenPose(here, 0, door)
    expect(pose.inRadius).toBe(false)
  })
})
