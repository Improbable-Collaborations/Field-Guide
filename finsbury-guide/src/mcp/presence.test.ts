import { describe, expect, it } from "vitest"
import { collectedPinsForJwt, rememberCollectedPinForJwt } from "./presence"

function jwtForAvatar(avatarId: string): string {
  const payload = Buffer.from(JSON.stringify({ avatarId }), "utf8").toString("base64url")
  return `eyJhbGciOiJub25lIn0.${payload}.x`
}

describe("MCP collected pins for the live Field Guide tab", () => {
  it("returns pins remembered after check-in", () => {
    const jwt = jwtForAvatar("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    rememberCollectedPinForJwt(jwt, "hitchhiker-stoop")
    expect(collectedPinsForJwt(jwt)).toContain("hitchhiker-stoop")
  })
})
