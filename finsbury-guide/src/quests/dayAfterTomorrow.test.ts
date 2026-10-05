import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { collectibleMintSpec, parseQuestPackJson, pinsFromGeoJson } from "field-guide-web4-client"
import { PLACES } from "../places"
import { ALEX } from "../trustGraph/personas"
import {
  DAY_AFTER_TOMORROW_CAFE_PIN_ID,
  DAY_AFTER_TOMORROW_LESSONS,
  DAY_AFTER_TOMORROW_PACK_FILE,
  DAY_AFTER_TOMORROW_PLACE_ID,
  DAY_AFTER_TOMORROW_QUEST_ID,
  DAY_AFTER_TOMORROW_SIT_PIN_IDS,
  DAY_AFTER_TOMORROW_TRAIL_FILE,
  dayAfterTomorrowPinVisible,
  sitLessonUnlocked,
} from "./dayAfterTomorrow"
import { formatDayAfterTomorrowVoice, openSitLesson } from "./dayAfterTomorrowVoice"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

describe("Day After Tomorrow sits", () => {
  it("keeps five sit pin ids = STAR objectives and NFT trailPinId", () => {
    const pack = JSON.parse(
      readFileSync(join(root, "public/quest-packs", DAY_AFTER_TOMORROW_PACK_FILE), "utf8"),
    ) as unknown
    const trail = readFileSync(join(root, "public/trails", DAY_AFTER_TOMORROW_TRAIL_FILE), "utf8")
    const catalog = JSON.parse(
      readFileSync(join(root, "public/trails/catalog.json"), "utf8"),
    ) as Array<{ file?: string; starQuestId?: string }>

    const quest = parseQuestPackJson(pack)
    const pins = pinsFromGeoJson(trail)
    expect(quest?.id).toBe(DAY_AFTER_TOMORROW_QUEST_ID)
    expect(quest?.objectives.map((o) => o.title)).toEqual([...DAY_AFTER_TOMORROW_SIT_PIN_IDS])
    expect(pins.filter((p) => p.dropKind === "sit").map((p) => p.id)).toEqual([...DAY_AFTER_TOMORROW_SIT_PIN_IDS])
    expect(pins.some((p) => p.id === DAY_AFTER_TOMORROW_CAFE_PIN_ID && p.dropKind === "cafe")).toBe(true)
    expect(pins.find((p) => p.id === "sit-still-stone")?.lat).toBeCloseTo(51.5728, 4)

    const place = PLACES.find((p) => p.id === DAY_AFTER_TOMORROW_PLACE_ID)
    expect(place?.starQuestId).toBe(DAY_AFTER_TOMORROW_QUEST_ID)
    expect(ALEX.clusters.find((c) => c.id === "park-circuit")?.placeIds).toContain(DAY_AFTER_TOMORROW_PLACE_ID)
    expect(catalog.find((e) => e.file === DAY_AFTER_TOMORROW_TRAIL_FILE)?.starQuestId).toBe(
      DAY_AFTER_TOMORROW_QUEST_ID,
    )
  })

  it("unlocks the next sit only when the previous NFT pin id is minted", () => {
    expect(sitLessonUnlocked("sit-still-stone", [])).toBe(true)
    expect(sitLessonUnlocked("sit-withdrawn-coin", [])).toBe(false)
    expect(sitLessonUnlocked("sit-withdrawn-coin", ["sit-still-stone"])).toBe(true)
    expect(
      dayAfterTomorrowPinVisible({
        pin: { id: "sit-empty-bowl", dropKind: "sit" },
        activeTrailId: DAY_AFTER_TOMORROW_PLACE_ID,
        mintedPinIds: ["sit-still-stone"],
      }),
    ).toBe(false)
    expect(
      dayAfterTomorrowPinVisible({
        pin: { id: DAY_AFTER_TOMORROW_CAFE_PIN_ID, dropKind: "cafe" },
        activeTrailId: DAY_AFTER_TOMORROW_PLACE_ID,
        mintedPinIds: [],
      }),
    ).toBe(true)
  })

  it("mints a unique symbol per sit, not GLOVE", () => {
    const symbols = DAY_AFTER_TOMORROW_LESSONS.map((l) => l.nftSymbol)
    expect(new Set(symbols).size).toBe(5)
    expect(symbols).toEqual(["STONE", "COIN", "BOWL", "SEED", "DAWN"])
    const spec = collectibleMintSpec(
      {
        id: "sit-still-stone",
        title: "Still Stone",
        notes: "nftSymbol=STONE nftImageUrl=https://example.com/stone.png",
        narrationText: "Sit.",
        lat: 51.57,
        lon: -0.09,
        imageUrl: "/icons/sit-stone.svg",
        dropKind: "sit",
        questRole: "sit",
      },
      "https://example.com/fallback.png",
    )
    expect("error" in spec).toBe(false)
    if ("error" in spec) return
    expect(spec.kind).toBe("sit")
    expect(spec.symbol).toBe("STONE")
    expect(spec.imageUrl).toBe("https://example.com/stone.png")
  })

  it("gives ChatGPT a sit companion line per open lesson", () => {
    expect(openSitLesson([])?.pinId).toBe("sit-still-stone")
    expect(openSitLesson(["sit-still-stone"])?.pinId).toBe("sit-withdrawn-coin")
    const pack = formatDayAfterTomorrowVoice({ mintedSitIds: ["sit-still-stone"] })
    expect(pack).toMatch(/not therapy/)
    expect(pack).toMatch(/Open sit: Withdrawn Coin/)
    expect(pack).toMatch(/Do not draft the message/)
    expect(pack).toMatch(/Still Stone \(STONE\)/)
  })
})
