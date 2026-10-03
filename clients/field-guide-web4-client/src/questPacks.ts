import type { QuestObjectiveLite, QuestSummary, TrailPin } from "./types.js"

export type TrailCatalogEntry = {
  id: string
  title: string
  file: string
  starQuestId: string
  wikiSlug: string
  atmosphere: string
}

export type QuestPackSpawn = {
  pinId?: string
  lat: number
  lon: number
  note?: string
}

export type QuestPackMeta = {
  questId: string
  name: string
  trailFile: string
  atmosphere: string
  gameSource: string
  description: string
  requiredPinIds: string[]
  spawnNear?: QuestPackSpawn
  raw: Record<string, unknown>
}

/** Same KnownPackFiles list as Unity QuestPackLoader (APK-safe). */
export const KNOWN_QUEST_PACK_FILES = [
  "cathedrons-order-i-quest.json",
  "murder-stones-quest.json",
  "stones-of-the-golden-valley-quest.json",
  "when-birds-fall-silent-quest.json",
  "wiltshire-crop-circles-quest.json",
  "jab-sw1-gloves-quest.json",
] as const

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v).trim() || fallback
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export function parseQuestPackJson(raw: unknown, debugPath = ""): QuestSummary | null {
  const root = asRecord(raw)
  if (!root) return null
  const id = str(root.questId ?? root.id ?? root.Id)
  if (!id) return null

  const quest: QuestSummary = {
    id,
    name: str(root.name ?? root.Name, "Quest"),
    description: str(root.description ?? root.Description),
    status: "NotStarted",
    progressPercent: 0,
    gameSource: str(root.gameSource ?? root.GameSource, "FieldGuide"),
    externalHandoffUri: "",
    trailFile: str(root.trailFile ?? root.TrailFile),
    atmosphere: str(root.atmosphere ?? root.Atmosphere),
    objectives: [],
  }

  const objs = root.objectives ?? root.Objectives
  if (Array.isArray(objs)) {
    for (const o of objs) {
      const rec = asRecord(o)
      if (!rec) continue
      const title = str(rec.title ?? rec.Title)
      const oid = str(rec.id ?? rec.Id)
      if (!title && !oid) continue
      quest.objectives.push({
        id: oid,
        title,
        order: Math.trunc(num(rec.order ?? rec.Order)),
        isCompleted: false,
        description: str(rec.description ?? rec.Description),
        progressSummary: "",
        progressPercent: 0,
      })
    }
  }

  if (quest.objectives.length === 0) {
    const pins = root.requiredPinIds ?? root.RequiredPinIds
    if (Array.isArray(pins)) {
      let order = 0
      for (const p of pins) {
        const pinId = str(p)
        if (!pinId) continue
        quest.objectives.push({
          id: "",
          title: pinId,
          order: order++,
          isCompleted: false,
          description: pinId,
          progressSummary: "",
          progressPercent: 0,
        })
      }
    }
  }

  quest.objectives.sort((a, b) => a.order - b.order)
  if (!quest.trailFile && debugPath) {
    /* keep empty; caller may fill from catalog */
  }
  return quest
}

export function parseQuestPackMeta(raw: unknown): QuestPackMeta | null {
  const quest = parseQuestPackJson(raw)
  const root = asRecord(raw)
  if (!quest || !root) return null
  const spawn = asRecord(root.spawnNear)
  const requiredPinIds = quest.objectives
    .map((o) => o.title)
    .filter(Boolean)
  return {
    questId: quest.id,
    name: quest.name,
    trailFile: quest.trailFile,
    atmosphere: quest.atmosphere,
    gameSource: quest.gameSource,
    description: quest.description,
    requiredPinIds,
    spawnNear: spawn
      ? {
          pinId: str(spawn.pinId) || undefined,
          lat: num(spawn.lat, NaN),
          lon: num(spawn.lon, NaN),
          note: str(spawn.note) || undefined,
        }
      : undefined,
    raw: root,
  }
}

export function parseTrailCatalog(raw: unknown): TrailCatalogEntry[] {
  if (!Array.isArray(raw)) return []
  const list: TrailCatalogEntry[] = []
  for (const n of raw) {
    const rec = asRecord(n)
    if (!rec) continue
    const id = str(rec.id)
    const file = str(rec.file)
    if (!id && !file) continue
    list.push({
      id,
      title: str(rec.title, id),
      file,
      starQuestId: str(rec.starQuestId ?? rec.questId),
      wikiSlug: str(rec.wikiSlug),
      atmosphere: str(rec.atmosphere),
    })
  }
  return list
}

export function pinsFromGeoJson(rawJson: string | unknown): TrailPin[] {
  let root: unknown = rawJson
  if (typeof rawJson === "string") {
    try {
      root = JSON.parse(rawJson)
    } catch {
      return []
    }
  }
  const rec = asRecord(root)
  if (!rec) return []
  const trailName = str(rec.name, "trail")
  const features = rec.features
  if (!Array.isArray(features)) return []

  const pins: TrailPin[] = []
  for (const f of features) {
    const feat = asRecord(f)
    if (!feat) continue
    const geom = asRecord(feat.geometry)
    if (!geom || str(geom.type) !== "Point") continue
    const coords = geom.coordinates
    if (!Array.isArray(coords) || coords.length < 2) continue
    const lon = num(coords[0], NaN)
    const lat = num(coords[1], NaN)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const p = asRecord(feat.properties) ?? {}

    let notes = str(p.notes)
    const exclusive = str(p.exclusiveRelicId)
    if (exclusive && !notes.toLowerCase().includes("exclusiverelicsid=")) {
      // Unity appends exclusiveRelicId= into notes when not already present.
      notes = notes ? `${notes};exclusiveRelicId=${exclusive}` : `exclusiveRelicId=${exclusive}`
    }

    const encounter = asRecord(p.encounter)
    const worldPrefab = str(p.worldPrefab) || str(encounter?.worldPrefab)

    pins.push({
      id: str(p.id, `${lon},${lat}`),
      title: str(p.title, str(p.id, "pin")),
      lon,
      lat,
      radiusM: num(p.radiusM, 75),
      order: Math.trunc(num(p.order, 999)),
      questRole: str(p.questRole, "waypoint"),
      trail: str(p.trail, trailName),
      wikiSlug: str(p.wikiSlug),
      place: str(p.place),
      notes,
      narrationText: str(p.narrationText),
      directionHint: str(p.directionHint),
      audioUrl: str(p.audioUrl),
      markerStyle: str(p.markerStyle),
      worldPrefab,
      trustOrigin: "",
      peerDisplayName: "",
      peerAvatarId: "",
      trustAudience: "",
      imageUrl: str(p.imageUrl),
      fileUrl: str(p.fileUrl),
      dropKind: str(p.dropKind),
      vaultId: "",
      temperament: "",
      forgeAttestationId: "",
      principalNotionalUsd: 0,
    })
  }

  pins.sort((a, b) => a.order - b.order)
  return pins
}

export function mergeQuestsWithLocalPacks(
  remote: QuestSummary[] | null | undefined,
  packs: QuestSummary[],
  catalog: TrailCatalogEntry[],
): QuestSummary[] {
  const list: QuestSummary[] = []
  const seen = new Set<string>()

  const add = (q: QuestSummary | null | undefined) => {
    if (!q?.id) return
    const key = q.id.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    list.push({ ...q, objectives: q.objectives.map((o) => ({ ...o })) })
  }

  for (const q of remote ?? []) add(q)
  for (const q of packs) add(q)

  for (const entry of catalog) {
    if (!entry.starQuestId) continue
    if (seen.has(entry.starQuestId.toLowerCase())) continue
    add({
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
    })
  }

  return list
}

export function resolveSpawn(
  meta: QuestPackMeta | null,
  pins: TrailPin[],
): { lat: number; lon: number } | null {
  if (meta?.spawnNear && Number.isFinite(meta.spawnNear.lat) && Number.isFinite(meta.spawnNear.lon)) {
    return { lat: meta.spawnNear.lat, lon: meta.spawnNear.lon }
  }
  const waypoint = pins.find((p) => p.questRole.toLowerCase() === "waypoint")
  if (waypoint) return { lat: waypoint.lat, lon: waypoint.lon }
  if (pins[0]) return { lat: pins[0].lat, lon: pins[0].lon }
  return null
}

export type { QuestObjectiveLite }
