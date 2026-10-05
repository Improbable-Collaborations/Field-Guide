import { describe, expect, it } from "vitest"
import { accumulatePlayed, gateSitDwell } from "./sitDwell"

describe("sit dwell gate", () => {
  it("blocks a short sit and skipped audio", () => {
    expect(
      gateSitDwell({ dwellSeconds: 10, audioSecondsPlayed: 10, requiredSeconds: 90 }),
    ).toMatch(/Sit in the radius/)
    expect(
      gateSitDwell({
        dwellSeconds: 90,
        audioSecondsPlayed: 90,
        requiredSeconds: 90,
        skipDetected: true,
      }),
    ).toMatch(/skip/)
    expect(
      gateSitDwell({ dwellSeconds: 90, audioSecondsPlayed: 20, requiredSeconds: 90 }),
    ).toMatch(/Listen/)
    expect(gateSitDwell({ dwellSeconds: 90, audioSecondsPlayed: 85, requiredSeconds: 90 })).toBeNull()
  })

  it("treats a large currentTime jump as a skip", () => {
    expect(accumulatePlayed(10, 2, 40).skipDetected).toBe(true)
    expect(accumulatePlayed(10, 2, 3).played).toBeCloseTo(11)
  })
})
