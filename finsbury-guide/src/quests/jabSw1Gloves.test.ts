import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parseQuestPackJson, pinsFromGeoJson } from "field-guide-web4-client"
import { PLACES } from "../places"
import { ALEX } from "../trustGraph/personas"
import {
  JAB_SW1_GLOVES_PACK_FILE,
  JAB_SW1_GLOVES_PLACE_ID,
  JAB_SW1_GLOVES_QUEST_ID,
  JAB_SW1_GLOVES_TRAIL_FILE,
  JAB_SW1_GLOVE_PIN_IDS,
  glovesQuestSelected,
  streetGlovePinVisible,
} from "./jabSw1Gloves"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

describe("JAB SW1 street gloves quest", () => {
  it("keeps pin id = objective title = catalog/place quest id", () => {
    const pack = JSON.parse(
      readFileSync(join(root, "public/quest-packs", JAB_SW1_GLOVES_PACK_FILE), "utf8"),
    ) as unknown
    const trail = readFileSync(join(root, "public/trails", JAB_SW1_GLOVES_TRAIL_FILE), "utf8")
    const catalog = JSON.parse(
      readFileSync(join(root, "public/trails/catalog.json"), "utf8"),
    ) as Array<{ file?: string; starQuestId?: string }>

    const quest = parseQuestPackJson(pack)
    const pins = pinsFromGeoJson(trail)
    const pinIds = pins.map((p) => p.id)
    const objectiveTitles = quest?.objectives.map((o) => o.title) ?? []

    expect(quest?.id).toBe(JAB_SW1_GLOVES_QUEST_ID)
    expect(quest?.gameSource).toBe("FieldGuide")
    expect(pinIds).toEqual([...JAB_SW1_GLOVE_PIN_IDS])
    expect(objectiveTitles).toEqual([...JAB_SW1_GLOVE_PIN_IDS])
    expect(pins.every((p) => p.dropKind === "glove" && p.questRole === "glove")).toBe(true)
    expect(pins.every((p) => p.lat > 51.49 && p.lat < 51.5 && p.lon < -0.14 && p.lon > -0.16)).toBe(
      true,
    )

    const place = PLACES.find((p) => p.id === JAB_SW1_GLOVES_PLACE_ID)
    expect(place?.starQuestId).toBe(JAB_SW1_GLOVES_QUEST_ID)
    expect(place?.trailFile).toBe(JAB_SW1_GLOVES_TRAIL_FILE)

    const boxing = ALEX.clusters.find((c) => c.id === "boxing")
    expect(boxing?.placeIds).toContain(JAB_SW1_GLOVES_PLACE_ID)
    expect(boxing?.starQuestIds).toContain(JAB_SW1_GLOVES_QUEST_ID)

    const cat = catalog.find((e) => e.file === JAB_SW1_GLOVES_TRAIL_FILE)
    expect(cat?.starQuestId).toBe(JAB_SW1_GLOVES_QUEST_ID)
  })

  it("hides glove pins until the street-gloves quest is the active trail", () => {
    expect(glovesQuestSelected("")).toBe(false)
    expect(glovesQuestSelected("jab-sw1-victoria")).toBe(false)
    expect(glovesQuestSelected(JAB_SW1_GLOVES_PLACE_ID)).toBe(true)
    expect(
      streetGlovePinVisible({
        isGlove: true,
        activeTrailId: "",
        personaAllowsGlovesPlace: true,
      }),
    ).toBe(false)
    expect(
      streetGlovePinVisible({
        isGlove: true,
        activeTrailId: JAB_SW1_GLOVES_PLACE_ID,
        personaAllowsGlovesPlace: false,
      }),
    ).toBe(false)
    expect(
      streetGlovePinVisible({
        isGlove: true,
        activeTrailId: JAB_SW1_GLOVES_PLACE_ID,
        personaAllowsGlovesPlace: true,
      }),
    ).toBe(true)
    expect(
      streetGlovePinVisible({
        isGlove: false,
        activeTrailId: "",
        personaAllowsGlovesPlace: false,
      }),
    ).toBe(true)
  })
})
