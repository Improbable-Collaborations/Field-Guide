/** One STAR quest, five sit lessons. Each sit mints a different themed SPL. */

export const DAY_AFTER_TOMORROW_QUEST_ID = "9a4c2e81-6f0b-4d3a-9c17-2e8b5a1d4c70"
export const DAY_AFTER_TOMORROW_TRAIL_FILE = "day-after-tomorrow.geojson"
export const DAY_AFTER_TOMORROW_PACK_FILE = "day-after-tomorrow-quest.json"
export const DAY_AFTER_TOMORROW_PLACE_ID = "trail-day-after-tomorrow"
export const DAY_AFTER_TOMORROW_CAFE_PIN_ID = "cafe-park-coffee"

/** Lawn south of the American / McKenzie gardens. Public park path. */
export const DAY_AFTER_TOMORROW_SIT_LAT = 51.5728
export const DAY_AFTER_TOMORROW_SIT_LON = -0.09855

/** Placeholder sit length until Aether / real guided audio ships. */
export const DAY_AFTER_TOMORROW_SIT_SECONDS = 90

export type DayAfterTomorrowLesson = {
  order: number
  pinId: string
  title: string
  nftTitle: string
  nftSymbol: string
  sitPrompt: string
  walkTheme: string
  sitSeconds: number
  audioUrl: string
  imageUrl: string
  nftImageUrl: string
}

export const DAY_AFTER_TOMORROW_LESSONS: DayAfterTomorrowLesson[] = [
  {
    order: 0,
    pinId: "sit-still-stone",
    title: "Still Stone",
    nftTitle: "Still Stone",
    nftSymbol: "STONE",
    sitPrompt: "You cannot change what is already here. Sit with it. Do not argue.",
    walkTheme: "Withdraw resistance",
    sitSeconds: DAY_AFTER_TOMORROW_SIT_SECONDS,
    audioUrl: "/audio/day-after-tomorrow-placeholder.wav",
    imageUrl: "/icons/sit-stone.svg",
    nftImageUrl: "https://via.placeholder.com/512/2c3a28/e8d5a3?text=STONE",
  },
  {
    order: 1,
    pinId: "sit-withdrawn-coin",
    title: "Withdrawn Coin",
    nftTitle: "Withdrawn Coin",
    nftSymbol: "COIN",
    sitPrompt: "Notice where attention is still out there. Bring the coin back.",
    walkTheme: "Attention inward",
    sitSeconds: DAY_AFTER_TOMORROW_SIT_SECONDS,
    audioUrl: "/audio/day-after-tomorrow-placeholder.wav",
    imageUrl: "/icons/sit-coin.svg",
    nftImageUrl: "https://via.placeholder.com/512/3a3220/f0d48a?text=COIN",
  },
  {
    order: 2,
    pinId: "sit-empty-bowl",
    title: "Empty Bowl",
    nftTitle: "Empty Bowl",
    nftSymbol: "BOWL",
    sitPrompt: "Sit as the one who is aware, not as the story in the bowl.",
    walkTheme: "Awareness of being",
    sitSeconds: DAY_AFTER_TOMORROW_SIT_SECONDS,
    audioUrl: "/audio/day-after-tomorrow-placeholder.wav",
    imageUrl: "/icons/sit-bowl.svg",
    nftImageUrl: "https://via.placeholder.com/512/1e2a32/a8d4e8?text=BOWL",
  },
  {
    order: 3,
    pinId: "sit-chosen-seed",
    title: "Chosen Seed",
    nftTitle: "Chosen Seed",
    nftSymbol: "SEED",
    sitPrompt: "Feel the identity that already has the life you would pick.",
    walkTheme: "Imagination as practice",
    sitSeconds: DAY_AFTER_TOMORROW_SIT_SECONDS,
    audioUrl: "/audio/day-after-tomorrow-placeholder.wav",
    imageUrl: "/icons/sit-seed.svg",
    nftImageUrl: "https://via.placeholder.com/512/24341c/9fd18a?text=SEED",
  },
  {
    order: 4,
    pinId: "sit-daybreak",
    title: "Daybreak",
    nftTitle: "Daybreak",
    nftSymbol: "DAWN",
    sitPrompt: "Today still belongs to who you were. Walk as the one who owns later.",
    walkTheme: "Agency",
    sitSeconds: DAY_AFTER_TOMORROW_SIT_SECONDS,
    audioUrl: "/audio/day-after-tomorrow-placeholder.wav",
    imageUrl: "/icons/sit-dawn.svg",
    nftImageUrl: "https://via.placeholder.com/512/3a2418/f3c07a?text=DAWN",
  },
]

export const DAY_AFTER_TOMORROW_SIT_PIN_IDS = DAY_AFTER_TOMORROW_LESSONS.map((l) => l.pinId)

export function dayAfterTomorrowSelected(activeTrailId: string): boolean {
  return activeTrailId === DAY_AFTER_TOMORROW_PLACE_ID
}

export function lessonForSitPin(pinId: string): DayAfterTomorrowLesson | undefined {
  return DAY_AFTER_TOMORROW_LESSONS.find((l) => l.pinId === pinId)
}

export function sitLessonUnlocked(pinId: string, mintedPinIds: string[]): boolean {
  const minted = new Set(mintedPinIds.map((id) => id.toLowerCase()))
  const lesson = lessonForSitPin(pinId)
  if (!lesson) return false
  if (lesson.order === 0) return true
  const prev = DAY_AFTER_TOMORROW_LESSONS[lesson.order - 1]
  return Boolean(prev && minted.has(prev.pinId.toLowerCase()))
}

export function dayAfterTomorrowPinVisible(opts: {
  pin: { id: string; dropKind?: string; questRole?: string }
  activeTrailId: string
  mintedPinIds: string[]
}): boolean {
  const kind = (opts.pin.dropKind || opts.pin.questRole || "").toLowerCase()
  const sit = kind === "sit" || opts.pin.id.toLowerCase().startsWith("sit-")
  const cafe = kind === "cafe" || opts.pin.id === DAY_AFTER_TOMORROW_CAFE_PIN_ID
  if (!sit && !cafe) return true
  if (!dayAfterTomorrowSelected(opts.activeTrailId)) return false
  if (cafe) return true
  return sitLessonUnlocked(opts.pin.id, opts.mintedPinIds)
}
