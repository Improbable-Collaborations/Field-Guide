import { describe, expect, it } from "vitest"
import { PLACES } from "../places"
import { relevantLiveEvents } from "./liveFeed"
import { ALEX, MARGARET, type DataCluster } from "./personas"
import { projectCluster, projectPersona, wornPersona, type Audience } from "./promise"

const nights = ALEX.clusters.find((c) => c.id === "nights")!
const boxing = ALEX.clusters.find((c) => c.id === "boxing")!
const SHOWN: Audience[] = ["public", "link", "acquaintance"]

describe("Promise projection of a personal graph", () => {
  it("never surfaces a field nobody listed, at any audience", () => {
    const withJunk = { ...nights, deviceModel: "Pixel 9" } as DataCluster
    for (const audience of SHOWN) {
      expect(projectCluster(withJunk, audience)).not.toHaveProperty("deviceModel")
    }
  })

  it("never projects his orbit or his quest ids", () => {
    for (const audience of SHOWN) {
      expect(projectCluster(nights, audience)).not.toHaveProperty("orbit")
      expect(projectCluster(boxing, audience)).not.toHaveProperty("starQuestIds")
    }
  })

  it("widens by tier: public places, link taste and rooms, acquaintance artists", () => {
    const pub = projectCluster(nights, "public")!
    expect(pub.placeIds).toEqual(nights.placeIds)
    expect(pub.genres).toBeUndefined()
    expect(pub.likedVenues).toBeUndefined()

    const link = projectCluster(nights, "link")!
    expect(link.genres).toEqual(nights.genres)
    expect(link.likedVenues).toEqual(nights.likedVenues)
    expect(link.artists).toBeUndefined()

    expect(projectCluster(nights, "acquaintance")!.artists).toEqual(nights.artists)
  })

  it("leaves a private vertex absent, not blank", () => {
    expect(projectCluster(nights, "private")).toBeNull()
    const capped: DataCluster = { ...nights, disclosure: { maxAudience: "private" } }
    expect(projectCluster(capped, "acquaintance")).toBeNull()
    const persona = projectPersona({ ...ALEX, clusters: [capped, boxing] }, "link")
    expect(persona.clusters.map((c) => c.id)).toEqual(["boxing"])
  })

  it("lets a vertex cap its audience and deny a field", () => {
    const capped: DataCluster = {
      ...nights,
      disclosure: { maxAudience: "public", deny: ["placeIds"] },
    }
    const out = projectCluster(capped, "acquaintance")!
    expect(out.genres).toBeUndefined()
    expect(out.placeIds).toBeUndefined()
    expect(out.label).toBe(nights.label)
  })

  it("does not hand back the owner's arrays", () => {
    const out = projectCluster(nights, "link")!
    expect(out.placeIds).not.toBe(nights.placeIds)
  })

  it("wears the demo people at link", () => {
    for (const persona of [ALEX, MARGARET]) {
      expect(wornPersona(persona)).toEqual(projectPersona(persona, "link"))
    }
  })

  it("keeps a friend's room off the wearer's map", () => {
    const night = {
      venueName: "Village Underground",
      lng: -0.0797,
      lat: 51.5246,
    }
    expect(relevantLiveEvents([night], ALEX, PLACES, "ra")).toHaveLength(1)
    expect(relevantLiveEvents([night], wornPersona(ALEX), PLACES, "ra")).toHaveLength(0)
  })
})
