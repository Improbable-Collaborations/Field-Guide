import { describe, expect, it } from "vitest"
import { findChatGptLocationInPayload, gateCheckIn, gpsFixFromArgs, questIdForPin, trailPinById } from "./checkInAtPin"

describe("MCP park check-in gate", () => {
  it("finds the Manor House beacon and its Railway quest id", () => {
    const pin = trailPinById("park-manor-house-gate")
    expect(pin?.lat).toBeCloseTo(51.57095, 4)
    expect(questIdForPin(pin!)).toBe("783700a0-5f6f-4861-993b-7c1ff76b3a26")
  })

  it("finds the Still Stone sit and requires dwell before mint", () => {
    const pin = trailPinById("sit-still-stone")
    expect(pin?.dropKind).toBe("sit")
    expect(questIdForPin(pin!)).toBe("9a4c2e81-6f0b-4d3a-9c17-2e8b5a1d4c70")
    expect(gateCheckIn(pin!, pin!.lat, pin!.lon, 8)).toBeNull()
  })

  it("finds the Hitchhiker House stoop", () => {
    const pin = trailPinById("hitchhiker-stoop")
    expect(pin?.dropKind).toBe("stoop")
    expect(questIdForPin(pin!)).toBe("e86e2c7d-7cdd-4542-b82d-7d1bd27b46df")
    expect(gateCheckIn(pin!, pin!.lat, pin!.lon, 8)).toBeNull()
  })

  it("rejects invented or missing GPS", () => {
    expect(gpsFixFromArgs({})).toMatch(/I'm here/)
  })

  it("reads openai/userLocation nested on initialize", () => {
    const pin = trailPinById("hitchhiker-stoop")!
    const gps = findChatGptLocationInPayload({
      method: "initialize",
      params: { _meta: { "openai/userLocation": { latitude: pin.lat, longitude: pin.lon } } },
    })
    expect(gps?.lat).toBeCloseTo(pin.lat, 4)
  })

  it("uses ChatGPT openai/userLocation when the model only has an address", () => {
    const pin = trailPinById("hitchhiker-stoop")!
    const gps = gpsFixFromArgs(
      {},
      { "openai/userLocation": { latitude: pin.lat, longitude: pin.lon } },
    )
    expect(typeof gps).not.toBe("string")
    if (typeof gps === "string") return
    expect(gateCheckIn(pin, gps.lat, gps.lon, 8)).toBeNull()
  })

  it("rejects a fix outside the radius", () => {
    const pin = trailPinById("park-manor-house-gate")!
    expect(gateCheckIn(pin, 51.5, -0.1)).toMatch(/Walk closer/)
  })

  it("accepts a fix on the pin", () => {
    const pin = trailPinById("park-manor-house-gate")!
    expect(gateCheckIn(pin, pin.lat, pin.lon, 8)).toBeNull()
  })
})
