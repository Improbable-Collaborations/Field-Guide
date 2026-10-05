import { createFieldGuideWeb4Client, isErrorBody, unwrapResult } from "field-guide-web4-client"
import { PLACES } from "../places"
import { JAB_SW1_GLOVES_QUEST_ID } from "../quests/jabSw1Gloves"
import {
  resolvePhotoLocation,
  type PersonalPhoto,
} from "../profile/personalPhoto"
import { savePersonalPhotoHolon, uploadPersonalImage } from "../profile/personalPhotosApi"
import { loadAuthoredTrailPins } from "./loadTrailPins"
import { memoryStorage } from "./memoryStorage"

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function decodeBase64Image(raw: string): Uint8Array {
  const comma = raw.indexOf(",")
  const payload = raw.startsWith("data:") && comma >= 0 ? raw.slice(comma + 1) : raw
  const buf = Buffer.from(payload.replace(/\s/g, ""), "base64")
  if (!buf.length) throw new Error("imageBase64 was empty.")
  return new Uint8Array(buf)
}

function mimeFromDataUrl(raw: string): string {
  const m = raw.match(/^data:([^;]+);base64,/i)
  return m?.[1] || ""
}

async function loggedInAvatarId(oasisBaseUrl: string, jwt: string): Promise<string> {
  const res = await fetch(`${oasisBaseUrl.replace(/\/$/, "")}/api/avatar/get-logged-in-avatar`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  const json: unknown = await res.json()
  if (!res.ok || isErrorBody(json).isError) {
    throw new Error(isErrorBody(json).message || "Could not load this avatar. Sign in on You, then Connect again.")
  }
  const avatar = unwrapResult(json)
  const rec = avatar && typeof avatar === "object" ? (avatar as Record<string, unknown>) : {}
  const id = String(rec.id ?? rec.Id ?? "")
  if (!id) throw new Error("OASIS did not return an avatar id.")
  return id
}

/** Persist a visitor photo on this avatar. Does not mint GLOVE, STAR collect, or edit published trails. */
export async function dropPersonalPhoto(
  jwt: string,
  args: Record<string, unknown>,
): Promise<PersonalPhoto> {
  const token = jwt.trim()
  if (!token) throw new Error("Sign in on You, then Connect, then drop the photo on this ticket.")

  const client = createFieldGuideWeb4Client({
    storage: memoryStorage({ "fg-web4.jwt": token }),
    listCacheTtlSeconds: 0,
    configuredQuestId: JAB_SW1_GLOVES_QUEST_ID,
    source: "field-guide-mcp",
  })
  const oasis = client.config.oasisBaseUrl
  const loc = resolvePhotoLocation(args, PLACES, loadAuthoredTrailPins(PLACES))
  const caption = str(args.caption) || str(args.title) || "Field photo"
  let imageUrl = str(args.imageUrl)
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("imageUrl must be http or https.")
  }
  const b64 = str(args.imageBase64) || str(args.image)
  if (!imageUrl && b64) {
    const bytes = decodeBase64Image(b64)
    imageUrl = await uploadPersonalImage({
      oasisBaseUrl: oasis,
      jwt: token,
      bytes,
      fileName: str(args.imageFileName) || "field-photo.jpg",
      contentType: str(args.imageMime) || mimeFromDataUrl(b64) || "image/jpeg",
    })
  }
  if (!imageUrl) {
    throw new Error("Need imageUrl or imageBase64. This writes a personal photo, not a GLOVE collect.")
  }
  const avatarId = await loggedInAvatarId(oasis, token)
  return savePersonalPhotoHolon({
    oasisBaseUrl: oasis,
    jwt: token,
    avatarId,
    photo: {
      lon: loc.lon,
      lat: loc.lat,
      caption,
      imageUrl,
      pinId: loc.pinId,
      placeId: loc.placeId,
    },
  })
}
