import type { TrailPin } from "field-guide-web4-client"
import { createFieldGuideWeb4Client, isSitPin, OASIS_SESSION_EXPIRED_MESSAGE } from "field-guide-web4-client"
import { PLACES } from "../places"
import { haversineMeters } from "../walk/geo"
import { loadAuthoredTrailPins } from "./loadTrailPins"
import { memoryStorage } from "./memoryStorage"
import { avatarIdFromJwt } from "./jwtAvatar"
import { rememberCollectedPinForJwt } from "./presence"
import { gateSitDwell, sitRequiredSeconds } from "../sit/sitDwell"


export function trailPinById(pinId: string): TrailPin | undefined {
  const id = pinId.trim()
  if (!id) return undefined
  return loadAuthoredTrailPins(PLACES).find((p) => p.id === id)
}

export function questIdForPin(pin: TrailPin): string {
  const fromNotes = pin.notes.match(/starQuestId=([0-9a-f-]{36})/i)
  if (fromNotes) return fromNotes[1]
  const place = PLACES.find((p) => (p.trailFile || "").replace(/\.geojson$/i, "") === pin.trail)
  return (place?.starQuestId || "").trim()
}

function numberField(rec: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = rec[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const n = Number(value)
      if (Number.isFinite(n)) return n
    }
  }
  return NaN
}

/** ChatGPT Apps may attach this on initialize or tools/call. Custom connectors often omit it. */
export function gpsFixFromChatGptMeta(meta: unknown): { lat: number; lon: number; accuracyM?: number } | undefined {
  if (!meta || typeof meta !== "object") return undefined
  const rec = meta as Record<string, unknown>
  const loc = rec["openai/userLocation"] ?? rec.userLocation
  if (!loc || typeof loc !== "object") return undefined
  const place = loc as Record<string, unknown>
  const lat = numberField(place, ["latitude", "lat"])
  const lon = numberField(place, ["longitude", "lon", "lng"])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined
  const accuracyM = numberField(place, ["accuracyM", "accuracy", "horizontalAccuracy"])
  return { lat, lon, accuracyM: Number.isFinite(accuracyM) ? accuracyM : undefined }
}

export function findChatGptLocationInPayload(node: unknown, depth = 0): { lat: number; lon: number; accuracyM?: number } | undefined {
  if (depth > 8 || node == null) return undefined
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findChatGptLocationInPayload(item, depth + 1)
      if (found) return found
    }
    return undefined
  }
  if (typeof node !== "object") return undefined
  const direct = gpsFixFromChatGptMeta(node)
  if (direct) return direct
  const rec = node as Record<string, unknown>
  if (rec.params) {
    const fromParams = findChatGptLocationInPayload(rec.params, depth + 1)
    if (fromParams) return fromParams
  }
  if (rec._meta) {
    const fromMeta = gpsFixFromChatGptMeta(rec._meta) ?? findChatGptLocationInPayload(rec._meta, depth + 1)
    if (fromMeta) return fromMeta
  }
  return undefined
}

const chatGptLocationByAvatar = new Map<string, { lat: number; lon: number; accuracyM?: number }>()

export function rememberChatGptLocationFromPayload(jwt: string, payload: unknown): void {
  const fix = findChatGptLocationInPayload(payload)
  if (!fix) return
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return
  chatGptLocationByAvatar.set(avatarId, fix)
}

export function storedChatGptLocation(jwt: string): { lat: number; lon: number; accuracyM?: number } | undefined {
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return undefined
  return chatGptLocationByAvatar.get(avatarId)
}

export function gpsFixFromArgs(
  args: Record<string, unknown>,
  meta?: unknown,
  stored?: { lat: number; lon: number; accuracyM?: number },
): { lat: number; lon: number; accuracyM?: number } | string {
  const lat = numberField(args, ["lat", "latitude"])
  const lon = numberField(args, ["lon", "longitude"])
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return "lat/lon are out of range."
    const accuracyM = numberField(args, ["accuracyM", "accuracy"])
    return { lat, lon, accuracyM: Number.isFinite(accuracyM) ? accuracyM : undefined }
  }
  const fromChat = gpsFixFromChatGptMeta(meta) ?? stored
  if (fromChat) return fromChat
  return "No GPS on this call. Open field_guide_look and tap I'm here (that sends phone GPS). Do not invent coordinates. Do not geocode a street address."
}

export function gateCheckIn(pin: TrailPin, lat: number, lon: number, accuracyM?: number): string | null {
  const meters = haversineMeters(lat, lon, pin.lat, pin.lon)
  if (accuracyM != null && accuracyM > pin.radiusM) {
    return `GPS ±${Math.round(accuracyM)}m is coarser than the ${pin.radiusM}m radius. Wait for a tighter fix.`
  }
  if (meters > pin.radiusM) {
    return `You are ${Math.round(meters)}m from ${pin.title} (need ${pin.radiusM}m). Walk closer, then check in again.`
  }
  return null
}

export async function checkInAtPin(
  jwt: string,
  args: Record<string, unknown>,
  meta?: unknown,
): Promise<{
  ok: true
  pinId: string
  meters: number
  result: unknown
} | { ok: false; message: string }> {
  const pinId = typeof args.pinId === "string" ? args.pinId.trim() : ""
  const pin = trailPinById(pinId)
  if (!pin) return { ok: false, message: `Unknown pin ${pinId || "(missing)"}.` }
  const gps = gpsFixFromArgs(args, meta, storedChatGptLocation(jwt))
  if (typeof gps === "string") return { ok: false, message: gps }
  const blocked = gateCheckIn(pin, gps.lat, gps.lon, gps.accuracyM)
  if (blocked) return { ok: false, message: blocked }
  if (isSitPin(pin)) {
    const dwellSeconds = numberField(args, ["dwellSeconds", "sitSeconds"])
    const audioSecondsPlayed = numberField(args, ["audioSecondsPlayed", "audioSeconds"])
    const skipDetected = args.skipDetected === true
    const sitBlocked = gateSitDwell({
      dwellSeconds: Number.isFinite(dwellSeconds) ? dwellSeconds : 0,
      audioSecondsPlayed: Number.isFinite(audioSecondsPlayed) ? audioSecondsPlayed : 0,
      requiredSeconds: sitRequiredSeconds(pin),
      skipDetected,
    })
    if (sitBlocked) return { ok: false, message: sitBlocked }
  }
  const questId = questIdForPin(pin)
  const client = createFieldGuideWeb4Client({
    storage: memoryStorage({ "fg-web4.jwt": jwt }),
    listCacheTtlSeconds: 0,
    configuredQuestId: questId,
    source: "field-guide-mcp",
  })
  if (!client.session.getJwt()) {
    return { ok: false, message: OASIS_SESSION_EXPIRED_MESSAGE }
  }
  const result = await client.checkIn.handle(pin, { questId })
  if (!result.ok) {
    return { ok: false, message: result.message || "Check-in failed." }
  }
  rememberCollectedPinForJwt(jwt, pin.id)
  return {
    ok: true,
    pinId: pin.id,
    meters: Math.round(haversineMeters(gps.lat, gps.lon, pin.lat, pin.lon)),
    result,
  }
}
