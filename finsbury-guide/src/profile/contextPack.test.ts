import { describe, expect, it } from "vitest"
import { loadAuthoredTrailPins } from "../mcp/loadTrailPins"
import { PLACES } from "../places"
import { ALEX } from "../trustGraph/personas"
import { chatSnapshot, formatFieldGuideContext } from "./contextPack"
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
    expect(pack).toMatch(/field_guide_map/)
    expect(pack).toMatch(/Live listings: not loaded/)
    expect(pack).toMatch(/field_guide_drop_photo/)
    expect(pack).toMatch(/read-only/)
    expect(pack).toMatch(/cannot edit trails/)
    expect(pack).toMatch(/Finsbury Park Circuit/)
    expect(pack).toMatch(/Day After Tomorrow companion/)
    expect(pack).toMatch(/not therapy/)
    expect(pack).toMatch(/not a breakup coach/)
    expect(pack).toMatch(/Open sit: Still Stone/)
    expect(pack).toMatch(/Do not try to improve it/)
    expect(pack).toMatch(/field_guide_sit/)
    expect(pack).toMatch(/I'm here/)
    expect(pack).toMatch(/field_guide_open_look|field_guide_look|field_guide_check_in/)
    expect(pack).toMatch(/7xKX/)
    expect(pack).toMatch(/field_guide_wallet/)
    expect(pack).not.toMatch(/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/)
  })

  it("keeps the avatar id, email and full wallet out of the chat", () => {
    const snap = buildProfileSnapshot({
      signedIn: true,
      avatarName: "",
      avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      avatarEmail: "max@example.com",
      wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      persona: ALEX,
      clusterId: null,
      places: PLACES,
      trailPins: loadAuthoredTrailPins(PLACES),
      checkedInIds: [],
      mintedIds: [],
    })
    const sent =
      formatFieldGuideContext(snap) +
      JSON.stringify(chatSnapshot({ ...snap, deviceModel: "Pixel 9" } as typeof snap))
    expect(sent).not.toMatch(/max@example\.com/)
    expect(sent).not.toMatch(/aaaaaaaa-bbbb/)
    expect(sent).not.toMatch(/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/)
    expect(sent).not.toMatch(/Pixel 9/)
  })

  it("lists RA events that are on the Field Guide map", () => {
    const snap = buildProfileSnapshot({
      signedIn: true,
      avatarName: "Max",
      avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      avatarEmail: "max@example.com",
      wallet: "",
      persona: ALEX,
      clusterId: "boxing",
      places: PLACES,
      trailPins: loadAuthoredTrailPins(PLACES),
      checkedInIds: [],
      mintedIds: [],
    })
    const pack = formatFieldGuideContext(snap, null, {
      raEvents: [
        {
          id: "1",
          title: "Fabric night",
          venueName: "Fabric",
          startDate: "2026-10-04T22:00:00.000Z",
          url: "https://ra.co/events/1",
          lng: -0.1,
          lat: 51.52,
          artists: [],
          genres: ["techno"],
        },
      ],
      gigs: [],
      nearby: [],
    })
    expect(pack).toMatch(/Fabric night/)
    expect(pack).toMatch(/Resident Advisor/)
  })

  it("steers park beacons from live GPS", () => {
    const snap = buildProfileSnapshot({
      signedIn: true,
      avatarName: "Max",
      avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      avatarEmail: "max@example.com",
      wallet: "",
      persona: ALEX,
      clusterId: "park-circuit",
      places: PLACES,
      trailPins: loadAuthoredTrailPins(PLACES),
      checkedInIds: [],
      mintedIds: [],
    })
    const pack = formatFieldGuideContext(snap, {
      mode: "walk",
      selectedPlaceId: "trail-finsbury-park-circuit",
      selectedPinId: "park-manor-house-gate",
      wearingPersonaId: "alex",
      wearingClusterId: "park-circuit",
      lat: 51.57095,
      lon: -0.09735,
      accuracyM: 8,
    })
    expect(pack).toMatch(/Manor House gate/)
    expect(pack).toMatch(/in radius, open Look then Collect/)
    expect(pack).toMatch(/field_guide_look then field_guide_check_in with pinId park-manor-house-gate/)
  })

  it("gives ChatGPT the open sit voice and Sit, not Look, on the lawn", () => {
    const snap = buildProfileSnapshot({
      signedIn: true,
      avatarName: "Max",
      avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      avatarEmail: "max@example.com",
      wallet: "",
      persona: ALEX,
      clusterId: "park-circuit",
      places: PLACES,
      trailPins: loadAuthoredTrailPins(PLACES),
      checkedInIds: [],
      mintedIds: ["sit-still-stone"],
    })
    const pack = formatFieldGuideContext(snap, {
      mode: "walk",
      selectedPlaceId: "trail-day-after-tomorrow",
      selectedPinId: "sit-withdrawn-coin",
      wearingPersonaId: "alex",
      wearingClusterId: "park-circuit",
      lat: 51.5728,
      lon: -0.09855,
      accuracyM: 8,
    })
    expect(pack).toMatch(/Speak as the sit companion/)
    expect(pack).toMatch(/Open sit: Withdrawn Coin/)
    expect(pack).toMatch(/Bring the coin back into the body/)
    expect(pack).toMatch(/Do not draft the message/)
    expect(pack).toMatch(/Tokens already in wallet: Still Stone \(STONE\)/)
    expect(pack).toMatch(/call field_guide_sit/)
    expect(pack).toMatch(/open sit-withdrawn-coin Withdrawn Coin[\s\S]{0,500}in radius, call field_guide_sit/)
  })
})
