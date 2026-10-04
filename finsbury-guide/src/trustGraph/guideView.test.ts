import { describe, expect, it } from "vitest"
import { PLACES } from "../places"
import {
  clusterMemberNames,
  clusterStories,
  layersFromClusters,
  personaAllowsPlace,
  personaShowsLayer,
  visiblePlaceIds,
} from "./guideView"
import { ALEX, MARGARET, clusterForFeed } from "./personas"

function idsFor(persona: typeof ALEX) {
  return new Set(visiblePlaceIds(PLACES, persona))
}

describe("Alex · nights, gyms, park circuit", () => {
  it("names clusters after packs of places, not Identity / Community / Karma", () => {
    const labels = ALEX.clusters.map((c) => c.label)
    expect(labels).toEqual(["Music he keeps", "JAB gyms", "Park circuit"])
    expect(labels.join(" ")).not.toMatch(/identity|community|karma|friends/i)
  })

  it("JAB cluster is both gyms plus the street gloves hunt", () => {
    const jab = ALEX.clusters.find((c) => c.id === "boxing")!
    expect(clusterMemberNames(jab, PLACES)).toEqual([
      "JAB Boxing Club SW1",
      "JAB Boxing Club EC1",
      "JAB SW1 Street Gloves",
    ])
    expect(jab.starQuestIds).toEqual(["8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22"])
  })

  it("keeps RA, Skiddle, sport, and park because those clusters exist", () => {
    expect(personaShowsLayer(ALEX, "ra", PLACES)).toBe(true)
    expect(personaShowsLayer(ALEX, "gigs", PLACES)).toBe(true)
    expect(personaShowsLayer(ALEX, "sport", PLACES)).toBe(true)
    expect(personaShowsLayer(ALEX, "park", PLACES)).toBe(true)
    expect(clusterForFeed(ALEX, "ra")?.id).toBe("nights")
    expect(clusterForFeed(MARGARET, "ra")).toBeNull()
  })

  it("has no cemetery or tourist-transit cluster; gloves are the trail", () => {
    expect(personaShowsLayer(ALEX, "trail", PLACES)).toBe(true)
    expect(personaShowsLayer(ALEX, "transit", PLACES)).toBe(false)
    expect(personaShowsLayer(ALEX, "culture", PLACES)).toBe(false)
    expect(idsFor(ALEX).has("trail-jab-sw1-gloves")).toBe(true)
    expect(idsFor(ALEX).has("trail-highgate")).toBe(false)
  })

  it("shows JAB, the Garage, the park, and the New River cafe edge", () => {
    const ids = idsFor(ALEX)
    expect(ids.has("jab-sw1-victoria")).toBe(true)
    expect(ids.has("jab-ec1-moorgate")).toBe(true)
    expect(ids.has("music-garage")).toBe(true)
    expect(ids.has("music-nambucca")).toBe(true)
    expect(ids.has("finsbury-park")).toBe(true)
    expect(ids.has("new-river-cafe-edge")).toBe(true)
  })

  it("hides Highgate, Bunhill, Crouch End, and Park Theatre", () => {
    const ids = idsFor(ALEX)
    expect(ids.has("trail-highgate")).toBe(false)
    expect(ids.has("trail-bunhill")).toBe(false)
    expect(ids.has("crouch-end")).toBe(false)
    expect(ids.has("music-park-theatre")).toBe(false)
    expect(ids.has("manor-house")).toBe(false)
  })

  it("isolating the boxing cluster drops the Garage", () => {
    const ids = new Set(visiblePlaceIds(PLACES, ALEX, "boxing"))
    expect(ids.has("jab-sw1-victoria")).toBe(true)
    expect(ids.has("music-garage")).toBe(false)
    expect(personaShowsLayer(ALEX, "ra", PLACES, "boxing")).toBe(false)
  })
})

describe("Margaret · walks, rooms, north London ground", () => {
  it("names clusters after walks and rooms, not Shared history", () => {
    const labels = MARGARET.clusters.map((c) => c.label)
    expect(labels).toEqual([
      "Memorial walks",
      "Theatres and chapels",
      "North London ground",
    ])
    expect(labels.join(" ")).not.toMatch(/identity|community|history|karma/i)
  })

  it("walk cluster members are the three memorial trails", () => {
    const walks = MARGARET.clusters.find((c) => c.id === "walks")!
    expect(walks.placeIds).toEqual([
      "trail-highgate",
      "trail-bunhill",
      "trail-bow-street",
    ])
  })

  it("keeps trails, culture, transit, and heritage rooms; no RA or boxing cluster", () => {
    expect(personaShowsLayer(MARGARET, "trail", PLACES)).toBe(true)
    expect(personaShowsLayer(MARGARET, "culture", PLACES)).toBe(true)
    expect(personaShowsLayer(MARGARET, "transit", PLACES)).toBe(true)
    expect(personaShowsLayer(MARGARET, "music", PLACES)).toBe(true)
    expect(personaShowsLayer(MARGARET, "ra", PLACES)).toBe(false)
    expect(personaShowsLayer(MARGARET, "gigs", PLACES)).toBe(false)
    expect(personaShowsLayer(MARGARET, "sport", PLACES)).toBe(false)
  })

  it("shows Highgate, Park Theatre, Union Chapel, and the tube", () => {
    const ids = idsFor(MARGARET)
    expect(ids.has("trail-highgate")).toBe(true)
    expect(ids.has("trail-bunhill")).toBe(true)
    expect(ids.has("music-park-theatre")).toBe(true)
    expect(ids.has("music-union-chapel")).toBe(true)
    expect(ids.has("crouch-end")).toBe(true)
    expect(ids.has("manor-house")).toBe(true)
    expect(ids.has("finsbury-park")).toBe(true)
  })

  it("hides JAB, the Garage, Nambucca, and Emirates", () => {
    const ids = idsFor(MARGARET)
    expect(ids.has("jab-sw1-victoria")).toBe(false)
    expect(ids.has("jab-ec1-moorgate")).toBe(false)
    expect(ids.has("music-garage")).toBe(false)
    expect(ids.has("music-nambucca")).toBe(false)
    expect(ids.has("arsenal-emirates")).toBe(false)
  })
})

describe("same Guide, two graphs of records", () => {
  it("the two graphs share the park and almost nothing of the nightlife pack", () => {
    const alex = idsFor(ALEX)
    const margaret = idsFor(MARGARET)
    const both = [...alex].filter((id) => margaret.has(id))
    expect(both).toContain("finsbury-park")
    expect(both).not.toContain("music-garage")
    expect(both).not.toContain("jab-sw1-victoria")
    expect(both).not.toContain("trail-highgate")
  })

  it("null persona (unsigned Guide) still allows every authored place", () => {
    const open = PLACES.filter((p) => personaAllowsPlace(null, p))
    expect(open.length).toBe(PLACES.length)
  })

  it("pins Newspeak House on the published culture layer, not on Alex or Margaret", () => {
    const house = PLACES.find((p) => p.id === "newspeak-house")!
    expect(house.type).toBe("culture")
    expect(house.coords[0]).toBeCloseTo(-0.07124, 4)
    expect(house.coords[1]).toBeCloseTo(51.52529, 4)
    expect(personaAllowsPlace(null, house)).toBe(true)
    expect(personaAllowsPlace(ALEX, house)).toBe(false)
    expect(personaAllowsPlace(MARGARET, house)).toBe(false)
  })

  it("derived layers come from cluster membership counts, not preset tip glow", () => {
    expect(layersFromClusters(ALEX, PLACES).sort()).toEqual(
      ["gigs", "hq", "music", "nearby", "park", "ra", "sport", "trail"].sort(),
    )
    expect(layersFromClusters(MARGARET, PLACES).sort()).toEqual(
      ["culture", "hq", "music", "park", "trail", "transit"].sort(),
    )
  })

  it("cluster stories name real places a visitor can act on", () => {
    const nights = clusterStories(ALEX, PLACES).find((s) => s.id === "nights")!
    expect(nights.count).toBe(8)
    expect(nights.preview[0]).toMatch(/Garage/)
    expect(nights.live.join(" ")).toMatch(/UK Garage|Jungle/)
    expect(nights.live.join(" ")).toMatch(/Sam/)
    expect(nights.color).toBe("#e8523a")
  })
})
