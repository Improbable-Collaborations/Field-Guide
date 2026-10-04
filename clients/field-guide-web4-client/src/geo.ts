import type { FieldGuideWeb4ClientConfig } from "./config.js"
import type { HttpClient } from "./http.js"
import {
  isErrorBody,
  readNumber,
  readString,
  requestJson,
  starUrl,
  unwrapResult,
} from "./http.js"
import type { NearbyArgs, TrailPin } from "./types.js"

type CacheEntry = { at: number; pins: TrailPin[]; raw: string }

function noteValue(packed: string, key: string): string {
  if (!packed || !key) return ""
  const needle = `${key}=`
  for (const part of packed.split(";")) {
    const trimmed = part.trim()
    if (trimmed.toLowerCase().startsWith(needle.toLowerCase())) {
      return trimmed.slice(needle.length).trim()
    }
  }
  return ""
}

function applyPowerCrystalFileUrl(
  fileUrl: string,
  state: {
    vaultId: string
    temperament: string
    forgeAttestationId: string
    principalNotional: number
  },
): void {
  if (!fileUrl.toLowerCase().startsWith("power-crystal://")) return
  const rest = fileUrl.slice("power-crystal://".length)
  const parts = rest.split("/")
  if (parts.length >= 4) {
    if (!state.vaultId) state.vaultId = parts[0]
    if (!state.temperament) state.temperament = parts[1]
    if (state.principalNotional <= 0) {
      const n = Number(parts[2])
      if (Number.isFinite(n)) state.principalNotional = n
    }
    if (!state.forgeAttestationId) state.forgeAttestationId = parts[3]
  } else if (parts.length >= 2) {
    if (!state.vaultId) state.vaultId = parts[0]
    if (!state.forgeAttestationId) state.forgeAttestationId = parts[parts.length - 1]
  }
}

function crystalScore(p: TrailPin): number {
  let s = 0
  if (p.fileUrl.toLowerCase().startsWith("power-crystal://")) s += 4
  if (p.vaultId) s += 2
  if (p.forgeAttestationId && !p.forgeAttestationId.startsWith("legacy-")) s += 2
  if (p.principalNotionalUsd > 0) s += 1
  return s
}

function dedupePowerCrystalPins(pins: TrailPin[]): TrailPin[] {
  if (pins.length < 2) return pins
  const best = new Map<string, TrailPin>()
  const order: string[] = []
  for (const p of pins) {
    if (!p?.id) continue
    const key = p.id.toLowerCase()
    const prev = best.get(key)
    if (!prev) {
      best.set(key, p)
      order.push(key)
      continue
    }
    if (crystalScore(p) >= crystalScore(prev)) best.set(key, p)
  }
  return order.map((k) => best.get(k)!)
}

function metaDouble(meta: unknown, key: string): number {
  if (meta == null || typeof meta !== "object") return NaN
  const v = (meta as Record<string, unknown>)[key]
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

export function parseNearbyJson(text: string): TrailPin[] {
  const pins: TrailPin[] = []
  let root: unknown
  try {
    root = JSON.parse(text)
  } catch {
    return pins
  }

  if (isErrorBody(root).isError) return pins
  let result = unwrapResult(root)
  if (result != null && typeof result === "object" && !Array.isArray(result)) {
    const inner = (result as Record<string, unknown>).result
    if (Array.isArray(inner)) result = inner
  }
  if (!Array.isArray(result)) return pins

  for (const n of result) {
    if (n == null || typeof n !== "object") continue
    const meta = (n as Record<string, unknown>).metaData
      ?? (n as Record<string, unknown>).MetaData
    let lat = metaDouble(meta, "lat")
    let lon = metaDouble(meta, "long")
    if (Number.isNaN(lon)) lon = metaDouble(meta, "lon")
    if (Number.isNaN(lon)) lon = metaDouble(meta, "lng")
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue

    const dna =
      (n as Record<string, unknown>).starnetdna
      ?? (n as Record<string, unknown>).STARNETDNA
      ?? (n as Record<string, unknown>).Starnetdna

    let pinId =
      readString(meta, "trailPinId")
      || readString(n, "id", "Id")
      || readString(dna, "id", "Id")
      || `${lon},${lat}`

    let trail = readString(meta, "trail")
    let role = readString(meta, "questRole")
    let style = readString(meta, "markerStyle")
    const source = readString(meta, "source")
    const web4 = readString(meta, "web4NftId")
    let kind = readString(meta, "kind")
    let imageUrl = readString(meta, "imageUrl")
    let fileUrl = readString(meta, "fileUrl")

    let vaultId = readString(meta, "vaultId", "VaultId")
    let temperament = readString(meta, "temperament", "Temperament")
    let forgeAttestationId = readString(meta, "forgeAttestationId", "ForgeAttestationId")
    let principalNotional =
      readNumber(meta, "principalNotionalUsd", "PrincipalNotionalUsd") || 0

    const notesRaw = readString(meta, "notes", "Notes")
    const hintRaw = readString(meta, "directionHint")
    const packed = notesRaw || hintRaw
    if (!vaultId) vaultId = noteValue(packed, "vaultId")
    if (!temperament) temperament = noteValue(packed, "temperament")
    if (!forgeAttestationId) forgeAttestationId = noteValue(packed, "forgeAttestationId")
    if (principalNotional <= 0) {
      const pn = noteValue(packed, "principalNotionalUsd")
      const n = Number(pn)
      if (Number.isFinite(n)) principalNotional = n
    }

    const crystalState = { vaultId, temperament, forgeAttestationId, principalNotional }
    applyPowerCrystalFileUrl(fileUrl, crystalState)
    vaultId = crystalState.vaultId
    temperament = crystalState.temperament
    forgeAttestationId = crystalState.forgeAttestationId
    principalNotional = crystalState.principalNotional

    if (!temperament && style) {
      if (style.toLowerCase().includes("hot")) temperament = "hot"
      else if (style.toLowerCase().includes("cool")) temperament = "cool"
    }
    if (!vaultId && temperament) {
      vaultId = temperament.toLowerCase() === "hot" ? "nvprime" : "nvylds"
    }

    const isPowerCrystal = kind.toLowerCase() === "power-crystal"
    if (isPowerCrystal && !forgeAttestationId) {
      forgeAttestationId = web4 || `legacy-${pinId}`
    }
    if (isPowerCrystal && principalNotional <= 0) {
      principalNotional = temperament.toLowerCase() === "hot" ? 25000 : 10000
    }

    const sharedDrop =
      !trail
      || trail.toLowerCase().includes("star-drop")
      || role.toLowerCase() === "drop"
      || kind.toLowerCase() === "guide"
      || isPowerCrystal
      || pinId.toLowerCase().startsWith("drop-")

    if (sharedDrop) {
      if (!trail) trail = isPowerCrystal ? "power-crystals" : "star-drop"
      if (!role) role = isPowerCrystal ? "crystal" : "drop"
      if (!style) {
        style = isPowerCrystal
          ? temperament.toLowerCase() === "hot" || vaultId === "nvprime"
            ? "power-crystal-hot"
            : "power-crystal-cool"
          : kind.toLowerCase() === "guide"
            ? "discover-library"
            : "discover-attraction"
      }
    }

    let notes = `source=${source || "star-nearby"}`
    if (web4) notes += `;web4NftId=${web4}`
    if (isPowerCrystal) {
      notes += `;vaultId=${vaultId};temperament=${temperament}`
      if (forgeAttestationId) notes += `;forgeAttestationId=${forgeAttestationId}`
      if (principalNotional > 0) notes += `;principalNotionalUsd=${principalNotional}`
    }

    let narration = readString(meta, "narrationText")
    if (!narration) {
      narration =
        readString(n, "description", "Description")
        || readString(dna, "description", "Description")
    }
    if (sharedDrop && !narration.trim()) {
      narration = isPowerCrystal
        ? "Power Crystal. Complete the rite to steward yield from this place."
        : kind.toLowerCase() === "guide"
          ? "A guide left on the street. Open it after you Witness."
          : "Shared world drop. Walk in range to Witness."
    }

    const title =
      readString(n, "name", "Name")
      || readString(dna, "name", "Name")
      || pinId

    const place = isPowerCrystal
      ? readString(meta, "place") || "Power Crystal"
      : sharedDrop
        ? kind.toLowerCase() === "guide" ? "Guide" : "Drop"
        : readString(meta, "place")

    let creatorName = readString(meta, "createdByAvatarName", "CreatedByAvatarName")
    if (!creatorName) creatorName = readString(n, "createdByAvatarName", "CreatedByAvatarName")

    const radiusM = metaDouble(meta, "radiusM")
    pins.push({
      id: pinId,
      title,
      lat,
      lon,
      radiusM: Number.isFinite(radiusM) ? radiusM : 75,
      trail,
      questRole: role || "waypoint",
      wikiSlug: readString(meta, "wikiSlug"),
      place,
      notes,
      narrationText: narration,
      directionHint: readString(meta, "directionHint"),
      audioUrl: readString(meta, "audioUrl"),
      markerStyle: style,
      worldPrefab: "",
      trustOrigin: "",
      peerDisplayName: "",
      peerAvatarId: "",
      trustAudience: "",
      imageUrl,
      fileUrl,
      dropKind: kind,
      authorName: creatorName,
      vaultId,
      temperament,
      forgeAttestationId,
      principalNotionalUsd: principalNotional,
      order: 0,
    })
  }

  return dedupePowerCrystalPins(pins)
}

function cacheKey(lat: number, lon: number, radiusKm: number): string {
  const latB = Math.round(lat * 100)
  const lonB = Math.round(lon * 100)
  const rB = Math.round(radiusKm)
  return `nearby_${latB}_${lonB}_${rB}`
}

export function createGeoApi(http: HttpClient, config: FieldGuideWeb4ClientConfig) {
  const cache = new Map<string, CacheEntry>()

  return {
    parseNearbyJson,

    invalidateNearbyCache() {
      cache.clear()
    },

    async nearby(args: NearbyArgs): Promise<TrailPin[]> {
      const key = cacheKey(args.lat, args.lon, args.radiusKm)
      const ttlMs = (args.ttlSec ?? config.nearbyCacheTtlSeconds ?? 600) * 1000
      if (!args.forceRefresh) {
        const hit = cache.get(key)
        if (hit && Date.now() - hit.at < ttlMs && hit.pins.length > 0) {
          return hit.pins.map((p) => ({ ...p }))
        }
      }

      const qs = new URLSearchParams({
        latitude: String(args.lat),
        longitude: String(args.lon),
        radiusKm: String(args.radiusKm),
      })
      const { status, text } = await requestJson(
        http,
        `${starUrl(http, "/api/GeoNFTs/nearby")}?${qs}`,
        { method: "GET" },
      )
      if (status < 200 || status >= 300) {
        console.warn("[field-guide-web4] nearby fail", status, text)
        return []
      }
      const pins = parseNearbyJson(text)
      if (pins.length > 0) {
        cache.set(key, { at: Date.now(), pins, raw: text })
      }
      return pins.map((p) => ({ ...p }))
    },

    async placePin(req: {
      name: string
      description: string
      latitude: number
      longitude: number
      radiusM?: number
      trailPinId: string
      trail?: string
      questRole?: string
      wikiSlug?: string
      web4NftId: string
      questId?: string
      source?: string
      imageUrl?: string
      fileUrl?: string
      kind?: string
      narrationText?: string
      markerStyle?: string
      createdByAvatarName?: string
      createdByAvatarId?: string
    }): Promise<{ ok: boolean; id: string; message: string }> {
      if (!req?.name?.trim()) return { ok: false, id: "", message: "Name required" }
      if (!http.getJwt()) {
        return { ok: false, id: "", message: "Sign in required to place a shared drop" }
      }

      const body = {
        Name: req.name,
        Description: req.description ?? "",
        Latitude: req.latitude,
        Longitude: req.longitude,
        RadiusM: req.radiusM ?? 75,
        TrailPinId: req.trailPinId,
        Trail: req.trail ?? "star-drop",
        QuestRole: req.questRole ?? "drop",
        WikiSlug: req.wikiSlug ?? "",
        Web4NftId: req.web4NftId,
        QuestId: req.questId ?? "",
        Source: req.source || config.source || "field-guide-web",
        ImageUrl: req.imageUrl ?? "",
        FileUrl: req.fileUrl ?? "",
        Kind: req.kind || "drop",
        NarrationText: req.narrationText ?? "",
        MarkerStyle: req.markerStyle ?? "",
        CreatedByAvatarName: req.createdByAvatarName ?? "",
        CreatedByAvatarId: req.createdByAvatarId ?? "",
      }

      const { status, json, text } = await requestJson(
        http,
        starUrl(http, "/api/GeoNFTs/place-pin"),
        { method: "POST", body: JSON.stringify(body) },
      )

      const err = isErrorBody(json)
      if (status < 200 || status >= 300 || err.isError) {
        return { ok: false, id: "", message: err.message || text || `HTTP ${status}` }
      }

      const node = unwrapResult(json) as Record<string, unknown> | null
      const id = readString(node, "id", "Id")
      cache.clear()
      return { ok: true, id, message: text }
    },

    async postStreetEvent(args: {
      trailPinId: string
      kind: string
      avatarName?: string
      avatarId?: string
    }): Promise<void> {
      if (!args.trailPinId || !http.getJwt()) return
      const body = {
        TrailPinId: args.trailPinId,
        Kind: args.kind,
        AvatarName: args.avatarName ?? "",
        AvatarId: args.avatarId ?? "",
      }
      const { status, text } = await requestJson(
        http,
        starUrl(http, "/api/GeoNFTs/street-event"),
        { method: "POST", body: JSON.stringify(body) },
      )
      if (status < 200 || status >= 300) {
        console.warn("[field-guide-web4] street-event", status, text)
      }
    },
  }
}

export type GeoApi = ReturnType<typeof createGeoApi>
