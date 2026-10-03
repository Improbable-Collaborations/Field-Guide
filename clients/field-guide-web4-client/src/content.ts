import type { FieldGuideWeb4ClientConfig } from "./config.js"
import {
  KNOWN_QUEST_PACK_FILES,
  mergeQuestsWithLocalPacks,
  parseQuestPackJson,
  parseQuestPackMeta,
  parseTrailCatalog,
  pinsFromGeoJson,
  resolveSpawn,
  type QuestPackMeta,
  type TrailCatalogEntry,
} from "./questPacks.js"
import type { QuestSummary, TrailPin } from "./types.js"

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "")
  const p = path.replace(/^\//, "")
  return `${b}/${p}`
}

async function fetchText(fetchImpl: typeof fetch, url: string): Promise<string | null> {
  try {
    const res = await fetchImpl(url, { method: "GET" })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown | null> {
  const text = await fetchText(fetchImpl, url)
  if (text == null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Loads Unity StreamingAssets-equivalent content served from field-guide-web
 * (`/quest-packs`, `/trails`).
 */
export function createContentApi(config: FieldGuideWeb4ClientConfig) {
  const fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis)
  const base = (config.contentBaseUrl ?? "").replace(/\/$/, "") || ""

  const packUrl = (file: string) =>
    joinUrl(base || ".", `quest-packs/${file.replace(/^quest-packs\//, "")}`)
  const trailUrl = (file: string) =>
    joinUrl(base || ".", `trails/${file.replace(/^trails\//, "")}`)

  return {
    knownPackFiles: [...KNOWN_QUEST_PACK_FILES],

    async loadCatalog(): Promise<TrailCatalogEntry[]> {
      const json = await fetchJson(fetchImpl, trailUrl("catalog.json"))
      return parseTrailCatalog(json)
    },

    async loadTrailFile(fileName: string): Promise<TrailPin[]> {
      if (!fileName) return []
      const text = await fetchText(fetchImpl, trailUrl(fileName))
      if (text == null) {
        console.warn("[field-guide-web4] missing trail", fileName)
        return []
      }
      return pinsFromGeoJson(text)
    },

    async loadAllPacks(): Promise<QuestSummary[]> {
      const list: QuestSummary[] = []
      for (const file of KNOWN_QUEST_PACK_FILES) {
        const json = await fetchJson(fetchImpl, packUrl(file))
        if (json == null) continue
        const q = parseQuestPackJson(json, file)
        if (q?.id) list.push(q)
      }
      return list
    },

    async loadPackByQuestId(questId: string): Promise<QuestSummary | null> {
      if (!questId) return null
      const packs = await this.loadAllPacks()
      return (
        packs.find((q) => q.id.toLowerCase() === questId.toLowerCase()) ?? null
      )
    },

    async loadPackMeta(questId: string): Promise<QuestPackMeta | null> {
      for (const file of KNOWN_QUEST_PACK_FILES) {
        const json = await fetchJson(fetchImpl, packUrl(file))
        if (json == null) continue
        const meta = parseQuestPackMeta(json)
        if (meta && meta.questId.toLowerCase() === questId.toLowerCase()) return meta
      }
      return null
    },

    async mergeWithRemote(remote: QuestSummary[]): Promise<QuestSummary[]> {
      const packs = await this.loadAllPacks()
      const catalog = await this.loadCatalog()
      return mergeQuestsWithLocalPacks(remote, packs, catalog)
    },

    /**
     * Full begin payload: quest DNA + trail pins + spawn focus.
     * Mirrors ActiveQuestRuntime trail bind from pack/catalog.
     */
    async loadQuestExperience(questId: string): Promise<{
      quest: QuestSummary | null
      meta: QuestPackMeta | null
      pins: TrailPin[]
      spawn: { lat: number; lon: number } | null
    }> {
      const packs = await this.loadAllPacks()
      let quest = packs.find((q) => q.id.toLowerCase() === questId.toLowerCase()) ?? null
      let meta = quest ? await this.loadPackMeta(questId) : null

      if (!quest) {
        const catalog = await this.loadCatalog()
        const entry = catalog.find(
          (c) => c.starQuestId.toLowerCase() === questId.toLowerCase(),
        )
        if (entry) {
          quest = {
            id: entry.starQuestId,
            name: entry.title || entry.id,
            description: `[trailFile=${entry.file}] [atmosphere=${entry.atmosphere}]`,
            status: "Catalog",
            progressPercent: 0,
            gameSource: "FieldGuide",
            externalHandoffUri: "",
            trailFile: entry.file,
            atmosphere: entry.atmosphere,
            objectives: [],
          }
        }
      }

      const trailFile = meta?.trailFile || quest?.trailFile || ""
      const pins = trailFile ? await this.loadTrailFile(trailFile) : []
      const spawn = resolveSpawn(meta, pins)
      return { quest, meta, pins, spawn }
    },

    pinsFromGeoJson,
    parseQuestPackJson,
    parseTrailCatalog,
  }
}

export type ContentApi = ReturnType<typeof createContentApi>
