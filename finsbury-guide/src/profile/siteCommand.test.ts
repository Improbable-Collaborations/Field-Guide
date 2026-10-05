import { describe, expect, it } from "vitest"
import { parseSiteCommand } from "./siteCommand"

describe("site command", () => {
  it("accepts open-look for the park circuit", () => {
    expect(
      parseSiteCommand({
        type: "open-look",
        placeId: "trail-finsbury-park-circuit",
        pinId: "park-manor-house-gate",
      }),
    ).toEqual({
      type: "open-look",
      placeId: "trail-finsbury-park-circuit",
      pinId: "park-manor-house-gate",
    })
  })

  it("rejects unknown types", () => {
    expect(parseSiteCommand({ type: "collect", placeId: "x" })).toMatch(/open-look/)
  })
})
