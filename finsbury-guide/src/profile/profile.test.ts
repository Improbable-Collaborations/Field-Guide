import { describe, expect, it } from "vitest"
import { ALEX } from "../trustGraph/personas"
import { PLACES } from "../places"
import { askFieldGuideAgent } from "./agent"
import { buildProfileSnapshot } from "./model"

const base = {
  signedIn: true,
  avatarName: "Max",
  avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  avatarEmail: "max@example.com",
  wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  persona: ALEX,
  clusterId: "boxing" as string | null,
  places: PLACES,
  trailPins: [] as [],
  checkedInIds: ["glove-victoria-door"],
  mintedIds: ["glove-victoria-door"],
}

describe("avatar desk snapshot", () => {
  it("joins glove collects onto Alex boxing and the SW1 guide", () => {
    const snap = buildProfileSnapshot(base)
    const gloves = snap.guides.find((g) => g.placeId === "trail-jab-sw1-gloves")
    const boxing = snap.clusters.find((c) => c.id === "boxing")
    expect(gloves?.collected).toBe(1)
    expect(gloves?.pinIds).toHaveLength(6)
    expect(gloves?.pins).toHaveLength(6)
    expect(gloves?.pins.find((p) => p.id === "glove-victoria-door")?.collected).toBe(true)
    expect(gloves?.desc).toMatch(/Street hunt/)
    expect(gloves?.complete).toBe(false)
    expect(boxing?.collected).toBe(1)
    expect(snap.experiences[0]?.kind).toBe("glove")
    expect(snap.nextStep?.pinId).toBe("glove-victoria-colonnade")
    expect(snap.nextStep?.guideName).toBe("JAB SW1 Street Gloves")
    expect(snap.pinsCollected).toBe(1)
    expect(snap.pinsKnown).toBeGreaterThanOrEqual(6)
    expect(snap.wearingClusterLabel).toBe("JAB gyms")
  })
})

describe("field guide agent", () => {
  it("opens the glove hunt and can wear Alex", () => {
    const snap = buildProfileSnapshot(base)
    const gloves = askFieldGuideAgent("where are the gloves?", snap)
    expect(gloves.action).toEqual({ type: "open-place", placeId: "trail-jab-sw1-gloves" })
    expect(gloves.text).toMatch(/1 of 6/)
    const wear = askFieldGuideAgent("wear Margaret", snap)
    expect(wear.action).toEqual({ type: "wear-persona", personaId: "margaret" })
  })
})
