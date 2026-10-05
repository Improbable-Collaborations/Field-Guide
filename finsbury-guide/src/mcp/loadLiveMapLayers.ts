import { createFieldGuideWeb4Client } from "field-guide-web4-client"
import type { TrailPin } from "field-guide-web4-client"
import { FINSBURY } from "../places"
import { JAB_SW1_GLOVES_QUEST_ID } from "../quests/jabSw1Gloves"
import { fetchRaLondon, type RaEvent } from "../ra"
import { fetchWhatsOn, type Gig } from "../whatsOn"
import { memoryStorage } from "./memoryStorage"

const NEARBY_RADIUS_KM = 5
const LIVE_TTL_MS = 10 * 60 * 1000

export type LiveMapLayers = {
  raEvents: RaEvent[]
  gigs: Gig[]
  nearby: TrailPin[]
}

let cache: { at: number; value: LiveMapLayers } | null = null
let inflight: Promise<LiveMapLayers> | null = null

async function fetchLiveMapLayers(jwt: string): Promise<LiveMapLayers> {
  const client = createFieldGuideWeb4Client({
    storage: memoryStorage(jwt ? { "fg-web4.jwt": jwt } : {}),
    listCacheTtlSeconds: 0,
    configuredQuestId: JAB_SW1_GLOVES_QUEST_ID,
    source: "field-guide-mcp",
  })
  const [raEvents, gigs, nearby] = await Promise.all([
    fetchRaLondon(),
    fetchWhatsOn(),
    client.geo.nearby({
      lat: FINSBURY[1],
      lon: FINSBURY[0],
      radiusKm: NEARBY_RADIUS_KM,
      forceRefresh: true,
    }),
  ])
  return { raEvents, gigs, nearby }
}

export async function loadLiveMapLayers(jwt: string): Promise<LiveMapLayers> {
  if (cache && Date.now() - cache.at < LIVE_TTL_MS) return cache.value
  if (inflight) return inflight
  inflight = fetchLiveMapLayers(jwt)
    .then((value) => {
      cache = { at: Date.now(), value }
      return value
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
