import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parseQuestPackJson, pinsFromGeoJson } from "field-guide-web4-client"
import { PLACES } from "../places"
import { ALEX } from "../trustGraph/personas"
import {
  HITCHHIKER_STOOP_PACK_FILE,
  HITCHHIKER_STOOP_PLACE_ID,
  HITCHHIKER_STOOP_QUEST_ID,
  HITCHHIKER_STOOP_TRAIL_FILE,
  HITCHHIKER_STOOP_PIN_ID,
} from "./hitchhikerStoop"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

describe("Hitchhiker Stoop smoke-test quest", () => {
  it("keeps one pavement pin = objective title = Railway quest id", () => {
    const pack = JSON.parse(
      readFileSync(join(root, "public/quest-packs", HITCHHIKER_STOOP_PACK_FILE), "utf8"),
    ) as unknown
    const trail = readFileSync(join(root, "public/trails", HITCHHIKER_STOOP_TRAIL_FILE), "utf8")
    const catalog = JSON.parse(
      readFileSync(join(root, "public/trails/catalog.json"), "utf8"),
    ) as Array<{ file?: string; starQuestId?: string }>

    const quest = parseQuestPackJson(pack)
    const pins = pinsFromGeoJson(trail)
    expect(quest?.id).toBe(HITCHHIKER_STOOP_QUEST_ID)
    expect(pins.map((p) => p.id)).toEqual([HITCHHIKER_STOOP_PIN_ID])
    expect(quest?.objectives.map((o) => o.title)).toEqual([HITCHHIKER_STOOP_PIN_ID])
    expect(pins[0]?.dropKind).toBe("stoop")
    expect(pins[0]?.lat).toBeCloseTo(51.563743, 4)
    expect(pins[0]?.lon).toBeCloseTo(-0.105181, 4)

    const place = PLACES.find((p) => p.id === HITCHHIKER_STOOP_PLACE_ID)
    expect(place?.starQuestId).toBe(HITCHHIKER_STOOP_QUEST_ID)
    expect(place?.trailFile).toBe(HITCHHIKER_STOOP_TRAIL_FILE)
    expect(ALEX.clusters.find((c) => c.id === "park-circuit")?.placeIds).toContain(HITCHHIKER_STOOP_PLACE_ID)
    expect(catalog.find((e) => e.file === HITCHHIKER_STOOP_TRAIL_FILE)?.starQuestId).toBe(
      HITCHHIKER_STOOP_QUEST_ID,
    )
  })
})
