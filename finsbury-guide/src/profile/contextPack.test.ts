import { describe, expect, it } from "vitest"
import { loadAuthoredTrailPins } from "../mcp/loadTrailPins"
import { PLACES } from "../places"
import { ALEX } from "../trustGraph/personas"
import { formatFieldGuideContext } from "./contextPack"
import { buildProfileSnapshot } from "./model"

describe("Field Guide context pack", () => {
  it("names the next glove and forbids a second collect path", () => {
    const snap = buildProfileSnapshot({
      signedIn: true,
      avatarName: "Max",
      avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      avatarEmail: "max@example.com",
      wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      persona: ALEX,
      clusterId: "boxing",
      places: PLACES,
      trailPins: loadAuthoredTrailPins(PLACES),
      checkedInIds: ["glove-victoria-door"],
      mintedIds: ["glove-victoria-door"],
    })
    const pack = formatFieldGuideContext(snap)
    expect(pack).toMatch(/JAB SW1 Street Gloves/)
    expect(pack).toMatch(/Club door mitt/)
    expect(pack).toMatch(/Along the colonnade/)
    expect(pack).toMatch(/read-only/)
    expect(pack).toMatch(/cannot edit trails/)
    expect(pack).toMatch(/Do not invent a second collect path/)
    expect(pack).toMatch(/7xKX/)
    expect(pack).not.toMatch(/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/)
  })
})
