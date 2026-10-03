import { describe, expect, it } from "vitest"
import { PLACES } from "../places"
import { ALEX, MARGARET } from "./personas"
import { relevantLiveEvents, labelsOverlap, venueNamesMatch } from "./liveFeed"

const garage = PLACES.find((p) => p.id === "music-garage")!
const chapel = PLACES.find((p) => p.id === "music-union-chapel")!

describe("RA nights follow taste, liked rooms, and orbit", () => {
  it("matches The Garage by name even when RA adds Highbury", () => {
    expect(venueNamesMatch("The Garage Highbury", "The Garage")).toBe(true)
  })

  it("treats RA Garage as the UK Garage label he keeps", () => {
    expect(labelsOverlap(["Garage"], ["UK Garage"])).toBe(true)
    expect(labelsOverlap(["Drum & Bass"], ["Drum & Bass"])).toBe(true)
  })

  it("keeps a night at a room he has actually liked", () => {
    const keep = relevantLiveEvents(
      [{ venueName: "The Garage", lng: garage.coords[0], lat: garage.coords[1] }],
      ALEX,
      PLACES,
      "ra",
    )
    expect(keep).toHaveLength(1)
  })

  it("keeps Fabric when the bill is jungle, not because it is nearby", () => {
    const jungle = relevantLiveEvents(
      [
        {
          venueName: "Fabric",
          lng: -0.1025,
          lat: 51.5195,
          genres: ["Jungle", "Drum & Bass"],
        },
      ],
      ALEX,
      PLACES,
      "ra",
    )
    const house = relevantLiveEvents(
      [
        {
          venueName: "Fabric",
          lng: -0.1025,
          lat: 51.5195,
          genres: ["Melodic House", "Progressive House"],
        },
      ],
      ALEX,
      PLACES,
      "ra",
    )
    expect(jungle).toHaveLength(1)
    expect(house).toHaveLength(0)
  })

  it("keeps Fold because Sam is going, even on a house night", () => {
    const keep = relevantLiveEvents(
      [
        {
          venueName: "Fold",
          lng: -0.03,
          lat: 51.52,
          genres: ["House"],
        },
      ],
      ALEX,
      PLACES,
      "ra",
    )
    expect(keep).toHaveLength(1)
  })

  it("drops a sitting-down chapel bill that is not his taste or orbit", () => {
    const keep = relevantLiveEvents(
      [
        {
          venueName: "Union Chapel",
          lng: chapel.coords[0],
          lat: chapel.coords[1],
          genres: ["Folk"],
        },
      ],
      ALEX,
      PLACES,
      "ra",
    )
    expect(keep).toHaveLength(0)
  })

  it("unsigned Guide still sees the full Knowledge feed", () => {
    const all = [
      { venueName: "Fabric", lng: -0.1025, lat: 51.5195, genres: ["House"] },
      { venueName: "The Garage", lng: garage.coords[0], lat: garage.coords[1] },
    ]
    expect(relevantLiveEvents(all, null, PLACES, "ra")).toHaveLength(2)
    expect(relevantLiveEvents(all, ALEX, PLACES, "ra")).toHaveLength(1)
  })

  it("Margaret has no RA vertex, so she gets no RA nights", () => {
    const row = {
      venueName: "The Garage",
      lng: garage.coords[0],
      lat: garage.coords[1],
      genres: ["Jungle"],
    }
    expect(relevantLiveEvents([row], MARGARET, PLACES, "ra")).toHaveLength(0)
  })
})
