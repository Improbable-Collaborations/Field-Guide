import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parseQuestPackJson, pinsFromGeoJson } from "field-guide-web4-client"
import { PLACES } from "../places"
import { ALEX } from "../trustGraph/personas"
import {
  FINSBURY_PARK_CIRCUIT_PACK_FILE,
  FINSBURY_PARK_CIRCUIT_PLACE_ID,
  FINSBURY_PARK_CIRCUIT_QUEST_ID,
  FINSBURY_PARK_CIRCUIT_TRAIL_FILE,
  FINSBURY_PARK_CIRCUIT_PIN_IDS,
  parkBeaconPinVisible,
  parkCircuitSelected,
} from "./finsburyParkCircuit"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

describe("Finsbury Park Circuit quest", () => {
  it("keeps pin id = objective title = place quest id, inside the park", () => {
    const pack = JSON.parse(
      readFileSync(join(root, "public/quest-packs", FINSBURY_PARK_CIRCUIT_PACK_FILE), "utf8"),
    ) as unknown
    const trail = readFileSync(join(root, "public/trails", FINSBURY_PARK_CIRCUIT_TRAIL_FILE), "utf8")
    const catalog = JSON.parse(
      readFileSync(join(root, "public/trails/catalog.json"), "utf8"),
    ) as Array<{ file?: string; starQuestId?: string }>

    const quest = parseQuestPackJson(pack)
    const pins = pinsFromGeoJson(trail)
    const pinIds = pins.map((p) => p.id)
    const objectiveTitles = quest?.objectives.map((o) => o.title) ?? []

    expect(quest?.id).toBe(FINSBURY_PARK_CIRCUIT_QUEST_ID)
    expect(quest?.gameSource).toBe("FieldGuide")
    expect(pinIds).toEqual([...FINSBURY_PARK_CIRCUIT_PIN_IDS])
    expect(objectiveTitles).toEqual([...FINSBURY_PARK_CIRCUIT_PIN_IDS])
    expect(pins.every((p) => p.dropKind === "beacon" && p.questRole === "beacon")).toBe(true)
    expect(pins.every((p) => p.lat > 51.567 && p.lat < 51.575 && p.lon < -0.096 && p.lon > -0.105)).toBe(
      true,
    )
    const fc = JSON.parse(trail) as { features: Array<{ geometry?: { type?: string } }> }
    expect(fc.features.some((f) => f.geometry?.type === "LineString")).toBe(true)

    const place = PLACES.find((p) => p.id === FINSBURY_PARK_CIRCUIT_PLACE_ID)
    expect(place?.starQuestId).toBe(FINSBURY_PARK_CIRCUIT_QUEST_ID)
    expect(place?.trailFile).toBe(FINSBURY_PARK_CIRCUIT_TRAIL_FILE)

    const circuit = ALEX.clusters.find((c) => c.id === "park-circuit")
    expect(circuit?.placeIds).toContain(FINSBURY_PARK_CIRCUIT_PLACE_ID)
    expect(circuit?.starQuestIds).toContain(FINSBURY_PARK_CIRCUIT_QUEST_ID)

    const cat = catalog.find((e) => e.file === FINSBURY_PARK_CIRCUIT_TRAIL_FILE)
    expect(cat?.starQuestId).toBe(FINSBURY_PARK_CIRCUIT_QUEST_ID)
  })

  it("hides park beacons until the circuit is the active trail", () => {
    expect(parkCircuitSelected("")).toBe(false)
    expect(parkCircuitSelected(FINSBURY_PARK_CIRCUIT_PLACE_ID)).toBe(true)
    expect(
      parkBeaconPinVisible({
        isBeacon: true,
        activeTrailId: "",
        personaAllowsCircuitPlace: true,
      }),
    ).toBe(false)
    expect(
      parkBeaconPinVisible({
        isBeacon: true,
        activeTrailId: FINSBURY_PARK_CIRCUIT_PLACE_ID,
        personaAllowsCircuitPlace: true,
      }),
    ).toBe(true)
  })
})
