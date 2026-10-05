import {
  isErrorBody,
  unwrapResult,
} from "field-guide-web4-client"
import { PERSONAL_PHOTO_KIND, photoFromHolon, photosFromHolonList, type PersonalPhoto } from "./personalPhoto"

function oasisJson(root: unknown): unknown {
  if (isErrorBody(root).isError) throw new Error(isErrorBody(root).message || "OASIS error")
  return unwrapResult(root)
}

export async function loadPersonalPhotos(args: {
  oasisBaseUrl: string
  jwt: string
  avatarId: string
}): Promise<PersonalPhoto[]> {
  const base = args.oasisBaseUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/api/data/load-holons-for-parent/${args.avatarId}/Holon/false/false/0/true/0`, {
    headers: { Authorization: `Bearer ${args.jwt}` },
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error("OASIS did not return holons JSON.")
  }
  if (!res.ok) {
    const err = isErrorBody(json)
    throw new Error(err.message || `Load personal photos failed (${res.status})`)
  }
  const list = oasisJson(json)
  return photosFromHolonList(Array.isArray(list) ? list : [])
}

export async function uploadPersonalImage(args: {
  oasisBaseUrl: string
  jwt: string
  bytes: Uint8Array
  fileName: string
  contentType: string
}): Promise<string> {
  const base = args.oasisBaseUrl.replace(/\/$/, "")
  const form = new FormData()
  form.append("file", new Blob([args.bytes as BlobPart], { type: args.contentType }), args.fileName)
  form.append("provider", "PinataOASIS")
  const res = await fetch(`${base}/api/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.jwt}` },
    body: form,
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error("OASIS upload did not return JSON.")
  }
  if (!res.ok || isErrorBody(json).isError) {
    throw new Error(isErrorBody(json).message || `Image upload failed (${res.status})`)
  }
  const url = unwrapResult(json)
  if (typeof url !== "string" || !url.trim()) throw new Error("OASIS upload returned no image URL.")
  return url.trim()
}

export async function savePersonalPhotoHolon(args: {
  oasisBaseUrl: string
  jwt: string
  avatarId: string
  photo: Omit<PersonalPhoto, "id">
}): Promise<PersonalPhoto> {
  const base = args.oasisBaseUrl.replace(/\/$/, "")
  const body = {
    holon: {
      name: args.photo.caption || "Field photo",
      description: args.photo.caption,
      parentHolonId: args.avatarId,
      holonType: "Holon",
      imageUrl: args.photo.imageUrl,
      metaData: {
        kind: PERSONAL_PHOTO_KIND,
        imageUrl: args.photo.imageUrl,
        longitude: args.photo.lon,
        latitude: args.photo.lat,
        lon: args.photo.lon,
        lat: args.photo.lat,
        caption: args.photo.caption,
        pinId: args.photo.pinId,
        placeId: args.photo.placeId,
      },
    },
    saveChildren: false,
    recursive: false,
    maxChildDepth: 0,
    continueOnError: true,
  }
  const res = await fetch(`${base}/api/data/save-holon`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error("OASIS save-holon did not return JSON.")
  }
  if (!res.ok || isErrorBody(json).isError) {
    throw new Error(isErrorBody(json).message || `Save personal photo failed (${res.status})`)
  }
  const saved = photoFromHolon(oasisJson(json))
  if (saved) return saved
  return {
    id: "saved",
    ...args.photo,
  }
}
