import type { Place } from "../places"
import type { TrailPin } from "field-guide-web4-client"

export const PERSONAL_PHOTO_KIND = "field-guide-personal-photo"

export type PersonalPhoto = {
  id: string
  lon: number
  lat: number
  caption: string
  imageUrl: string
  pinId: string
  placeId: string
}

export type PhotoLocationInput = {
  longitude?: unknown
  latitude?: unknown
  lon?: unknown
  lat?: unknown
  pinId?: unknown
  placeId?: unknown
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

/** Resolve lon/lat from a named pin/place, or from explicit coordinates. Do not invent a location. */
export function resolvePhotoLocation(
  input: PhotoLocationInput,
  places: Place[],
  pins: TrailPin[],
): { lon: number; lat: number; pinId: string; placeId: string } {
  const pinId = str(input.pinId)
  const placeId = str(input.placeId)
  if (pinId) {
    const pin = pins.find((p) => p.id === pinId)
    if (!pin || !Number.isFinite(pin.lon) || !Number.isFinite(pin.lat)) {
      throw new Error(`Unknown pinId ${pinId}. Use an authored Field Guide pin id.`)
    }
    return { lon: pin.lon, lat: pin.lat, pinId: pin.id, placeId }
  }
  if (placeId) {
    const place = places.find((p) => p.id === placeId)
    if (!place) throw new Error(`Unknown placeId ${placeId}.`)
    return { lon: place.coords[0], lat: place.coords[1], pinId: "", placeId: place.id }
  }
  const lon = num(input.longitude) ?? num(input.lon)
  const lat = num(input.latitude) ?? num(input.lat)
  if (lon == null || lat == null) {
    throw new Error("Need longitude and latitude, or pinId, or placeId. Do not invent coordinates.")
  }
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error("Coordinates out of range.")
  }
  return { lon, lat, pinId: "", placeId: "" }
}

function metaOf(rec: Record<string, unknown>): Record<string, unknown> {
  const meta = rec.metaData ?? rec.MetaData
  if (meta && typeof meta === "object" && !Array.isArray(meta)) return meta as Record<string, unknown>
  return {}
}

export function photoFromHolon(raw: unknown): PersonalPhoto | null {
  if (!raw || typeof raw !== "object") return null
  const rec = raw as Record<string, unknown>
  const meta = metaOf(rec)
  if (str(meta.kind) !== PERSONAL_PHOTO_KIND) return null
  const imageUrl = str(meta.imageUrl) || str(rec.imageUrl) || str(rec.ImageUrl)
  const lon = num(meta.longitude) ?? num(meta.lon)
  const lat = num(meta.latitude) ?? num(meta.lat)
  if (!imageUrl || lon == null || lat == null) return null
  const id = str(rec.id) || str(rec.Id)
  if (!id) return null
  return {
    id,
    lon,
    lat,
    caption: str(meta.caption) || str(rec.name) || str(rec.Name) || "Field photo",
    imageUrl,
    pinId: str(meta.pinId),
    placeId: str(meta.placeId),
  }
}

export function photosFromHolonList(raw: unknown): PersonalPhoto[] {
  if (!Array.isArray(raw)) return []
  return raw.map(photoFromHolon).filter((p): p is PersonalPhoto => Boolean(p))
}
