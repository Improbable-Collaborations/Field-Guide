import type { FieldGuideWeb4ClientConfig } from "./config.js"
import type { HttpClient } from "./http.js"
import {
  isErrorBody,
  readBool,
  readNumber,
  readString,
  requestJson,
  starUrl,
  unwrapResult,
} from "./http.js"
import type { SessionApi } from "./session.js"
import type { ApiResult, QuestObjectiveLite, QuestSummary } from "./types.js"

function parseObjective(node: unknown): QuestObjectiveLite | null {
  if (node == null || typeof node !== "object") return null
  const title =
    readString(node, "title", "Title", "name", "Name") ||
    readString(node, "id", "Id")
  const id = readString(node, "id", "Id")
  if (!title && !id) return null
  return {
    id,
    title,
    order: Math.trunc(readNumber(node, "order", "Order") || 0),
    isCompleted: readBool(node, "isCompleted", "IsCompleted"),
    description: readString(node, "description", "Description"),
    progressSummary: readString(node, "progressSummary", "ProgressSummary"),
    progressPercent: readNumber(node, "progressPercent", "ProgressPercent") || 0,
  }
}

function applyMetaFromDescription(q: QuestSummary): void {
  if (!q.description) return
  const trail = q.description.match(/\[trailFile=([^\]]+)\]/i)?.[1]
    ?? q.description.match(/trailFile\s*=\s*([^\s,\]]+)/i)?.[1]
  const atmos = q.description.match(/\[atmosphere=([^\]]+)\]/i)?.[1]
    ?? q.description.match(/atmosphere\s*=\s*([^\s,\]]+)/i)?.[1]
  if (trail) q.trailFile = trail.trim()
  if (atmos) q.atmosphere = atmos.trim()
}

export function parseQuestNode(node: unknown): QuestSummary | null {
  if (node == null || typeof node !== "object") return null
  const id = readString(node, "id", "Id")
  if (!id) return null

  const q: QuestSummary = {
    id,
    name: readString(node, "name", "Name") || id,
    description: readString(node, "description", "Description"),
    status: readString(node, "status", "Status"),
    progressPercent: readNumber(node, "progressPercent", "ProgressPercent") || 0,
    gameSource: readString(node, "gameSource", "GameSource"),
    externalHandoffUri: readString(node, "externalHandoffUri", "ExternalHandoffUri"),
    trailFile: readString(node, "trailFile", "TrailFile"),
    atmosphere: readString(node, "atmosphere", "Atmosphere"),
    objectives: [],
  }

  const meta = (node as Record<string, unknown>).metaData
    ?? (node as Record<string, unknown>).MetaData
  if (meta && typeof meta === "object") {
    const tf = readString(meta, "trailFile", "TrailFile")
    const at = readString(meta, "atmosphere", "Atmosphere")
    if (tf) q.trailFile = tf
    if (at) q.atmosphere = at
  }

  applyMetaFromDescription(q)

  const objs =
    (node as Record<string, unknown>).objectives
    ?? (node as Record<string, unknown>).Objectives
  if (Array.isArray(objs)) {
    for (const o of objs) {
      const lite = parseObjective(o)
      if (lite) q.objectives.push(lite)
    }
    q.objectives.sort((a, b) => a.order - b.order)
  }

  return q
}

function cloneQuest(q: QuestSummary): QuestSummary {
  return {
    ...q,
    objectives: q.objectives.map((o) => ({ ...o })),
  }
}

export function createQuestsApi(
  http: HttpClient,
  session: SessionApi,
  config: FieldGuideWeb4ClientConfig,
) {
  let memoryList: QuestSummary[] | null = null
  let memoryListAt = 0
  const detailMemory = new Map<string, QuestSummary>()

  function rememberDetail(q: QuestSummary): void {
    detailMemory.set(q.id, cloneQuest(q))
    session.setJson(session.keys.questDetailPrefix + q.id, JSON.stringify(q))
  }

  function loadDetailDisk(questId: string): QuestSummary | null {
    const raw = session.getJson(session.keys.questDetailPrefix + questId)
    if (!raw) return null
    try {
      return parseQuestNode(JSON.parse(raw))
    } catch {
      return null
    }
  }

  function saveDiskList(list: QuestSummary[]): void {
    session.setJson(session.keys.questListCache, JSON.stringify(list))
    session.setJson(session.keys.questListCacheAt, String(Math.floor(Date.now() / 1000)))
  }

  function tryLoadDiskList(): QuestSummary[] | null {
    const atRaw = session.getJson(session.keys.questListCacheAt)
    const atUnix = atRaw ? Number(atRaw) : NaN
    if (!Number.isFinite(atUnix)) return null
    const ttl = config.listCacheTtlSeconds ?? 120
    if (Math.floor(Date.now() / 1000) - atUnix > ttl) return null
    const raw = session.getJson(session.keys.questListCache)
    if (!raw) return null
    try {
      const arr = JSON.parse(raw) as unknown
      if (!Array.isArray(arr)) return null
      const list: QuestSummary[] = []
      for (const n of arr) {
        const q = parseQuestNode(n)
        if (!q) continue
        list.push(q)
        if (q.objectives.length > 0) rememberDetail(q)
      }
      return list.length > 0 ? list : null
    } catch {
      return null
    }
  }

  function buildConfiguredStub(questId: string): QuestSummary {
    const disk = loadDetailDisk(questId)
    if (disk && disk.objectives.length > 0) return disk
    return {
      id: questId,
      name: "Quest",
      description: "No STAR objectives cached. Sign in or load a quest pack.",
      status: session.hasStartedLocally(questId) ? "InProgress" : "NotStarted",
      progressPercent: 0,
      gameSource: "",
      externalHandoffUri: "",
      trailFile: "",
      atmosphere: "",
      objectives: [],
    }
  }

  async function mergeConfigured(list: QuestSummary[]): Promise<void> {
    const configuredId = config.configuredQuestId ?? ""
    if (!configuredId) return
    if (list.some((q) => q.id.toLowerCase() === configuredId.toLowerCase())) return
    const detail = await getQuest(configuredId)
    list.unshift(detail ?? buildConfiguredStub(configuredId))
  }

  async function getQuest(questId: string, opts?: { fresh?: boolean }): Promise<QuestSummary | null> {
    if (!questId) return null
    if (opts?.fresh) detailMemory.delete(questId)

    const mem = detailMemory.get(questId)
    if (mem && mem.objectives.length > 0 && !opts?.fresh) return cloneQuest(mem)

    if (session.hasJwt()) {
      const { status, json, text } = await requestJson(
        http,
        starUrl(http, `/api/Quests/${encodeURIComponent(questId)}`),
      )
      if (status >= 200 && status < 300 && !isErrorBody(json).isError) {
        const parsed = parseQuestNode(unwrapResult(json))
        if (parsed?.id) {
          if ((!parsed.objectives || parsed.objectives.length === 0) && mem?.objectives.length) {
            parsed.objectives = mem.objectives.map((o) => ({ ...o }))
          }
          rememberDetail(parsed)
          return cloneQuest(parsed)
        }
      } else {
        console.warn("[field-guide-web4] quest get fail", status, text)
      }
    }

    const disk = loadDetailDisk(questId)
    if (disk && disk.objectives.length > 0) {
      rememberDetail(disk)
      return cloneQuest(disk)
    }

    if (questId.toLowerCase() === (config.configuredQuestId ?? "").toLowerCase()) {
      return buildConfiguredStub(questId)
    }
    return null
  }

  return {
    async list(opts?: { fresh?: boolean }): Promise<QuestSummary[]> {
      const ttl = (config.listCacheTtlSeconds ?? 120) * 1000
      if (!opts?.fresh && memoryList && Date.now() - memoryListAt < ttl) {
        return memoryList.map(cloneQuest)
      }

      const list: QuestSummary[] = []
      if (session.hasJwt()) {
        const { status, json, text } = await requestJson(
          http,
          starUrl(http, "/api/Quests/all-for-avatar/game"),
        )
        if (status >= 200 && status < 300 && !isErrorBody(json).isError) {
          const result = unwrapResult(json)
          if (Array.isArray(result)) {
            for (const n of result) {
              const q = parseQuestNode(n)
              if (!q?.id) continue
              list.push(q)
              if (q.objectives.length > 0) rememberDetail(q)
            }
          }
        } else {
          console.warn("[field-guide-web4] quest list fail", status, text)
        }
      }

      if (list.length === 0) {
        const disk = tryLoadDiskList()
        if (disk) {
          memoryList = disk
          memoryListAt = Date.now()
          return disk.map(cloneQuest)
        }
      }

      await mergeConfigured(list)
      memoryList = list.map(cloneQuest)
      memoryListAt = Date.now()
      saveDiskList(list)
      return list.map(cloneQuest)
    },

    async syncSessionFromStar(): Promise<string[]> {
      const applied: string[] = []
      const list = await (this as { list: (opts?: { fresh?: boolean }) => Promise<QuestSummary[]> }).list({
        fresh: true,
      })
      for (const q of list) {
        for (const o of q.objectives) {
          if (!o.isCompleted || !o.title) continue
          session.markCheckedIn(o.title)
          applied.push(o.title)
        }
      }
      return applied
    },

    get: getQuest,

    invalidateListCache() {
      memoryList = null
      memoryListAt = 0
      session.remove(session.keys.questListCache)
      session.remove(session.keys.questListCacheAt)
    },

    hasStartedLocally: (questId: string) => session.hasStartedLocally(questId),
    markStartedLocally: (questId: string) => session.markStartedLocally(questId),

    requiredPinIds(quest: QuestSummary): string[] {
      const pins: string[] = []
      const ordered = [...quest.objectives].sort((a, b) => a.order - b.order)
      for (const o of ordered) {
        if (!o?.title) continue
        if (!pins.includes(o.title)) pins.push(o.title)
      }
      return pins
    },

    nextIncomplete(quest: QuestSummary): QuestObjectiveLite | null {
      const ordered = [...quest.objectives].sort((a, b) => a.order - b.order)
      for (const o of ordered) {
        if (!o) continue
        if (o.isCompleted) continue
        if (o.title && session.isCheckedIn(o.title)) continue
        return { ...o }
      }
      return null
    },

    allComplete(quest: QuestSummary): boolean {
      if (!quest.objectives.length) return false
      return quest.objectives.every(
        (o) => o.isCompleted || (o.title != null && session.isCheckedIn(o.title)),
      )
    },

    countCompleted(quest: QuestSummary): number {
      return quest.objectives.filter(
        (o) => o.isCompleted || (o.title != null && session.isCheckedIn(o.title)),
      ).length
    },

    markObjectiveCompletedLocally(questId: string, pinId: string) {
      const q = detailMemory.get(questId)
      if (!q) return
      for (const o of q.objectives) {
        if (o.title.toLowerCase() === pinId.toLowerCase()) o.isCompleted = true
      }
      rememberDetail(q)
    },

    async start(questId: string): Promise<ApiResult> {
      if (!questId) return { ok: false, message: "No quest id" }
      if (!session.hasJwt()) return { ok: false, message: "Sign in required for STAR quests" }

      const { status, json, text } = await requestJson(
        http,
        starUrl(http, `/api/Quests/${encodeURIComponent(questId)}/start`),
        { method: "POST", body: '""' },
      )
      const err = isErrorBody(json)
      if (status < 200 || status >= 300 || err.isError) {
        return { ok: false, message: err.message || text || `HTTP ${status}` }
      }
      session.markStartedLocally(questId)
      memoryList = null
      return { ok: true }
    },

    async progress(questId: string, pinId: string): Promise<ApiResult> {
      if (!questId || !session.hasJwt()) {
        return { ok: false, message: "Missing quest id or JWT" }
      }
      const body = {
        GameSource: "FieldGuide",
        GenericItemPickup: 1,
        ItemCollectedName: pinId || "trail-check-in",
      }
      const { status, json, text } = await requestJson(
        http,
        starUrl(http, `/api/Quests/${encodeURIComponent(questId)}/progress`),
        { method: "POST", body: JSON.stringify(body) },
      )
      const err = isErrorBody(json)
      if (status < 200 || status >= 300 || err.isError) {
        return { ok: false, message: err.message || text || `HTTP ${status}` }
      }
      const q = detailMemory.get(questId)
      if (q) {
        for (const o of q.objectives) {
          if (o.title.toLowerCase() === (pinId || "").toLowerCase()) o.isCompleted = true
        }
        rememberDetail(q)
      }
      memoryList = null
      return { ok: true }
    },

    async complete(questId: string): Promise<ApiResult> {
      if (!questId || !session.hasJwt()) {
        return { ok: false, message: "Missing quest id or JWT" }
      }
      const { status, json, text } = await requestJson(
        http,
        starUrl(http, `/api/Quests/${encodeURIComponent(questId)}/complete`),
        { method: "POST", body: '""' },
      )
      const err = isErrorBody(json)
      if (status < 200 || status >= 300 || err.isError) {
        return { ok: false, message: err.message || text || `HTTP ${status}` }
      }
      memoryList = null
      return { ok: true }
    },
  }
}

export type QuestsApi = ReturnType<typeof createQuestsApi>
