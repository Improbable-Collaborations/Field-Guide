import type { TrailPin } from "./types.js"

export function noteTag(notes: string, key: string): string {
  const match = notes.match(new RegExp(`(?:^|[;\\s])${key}=([^;\\s]+)`, "i"))
  return match?.[1]?.trim() || ""
}

/** Street glove: pin id is STAR objective title and NFT trailPinId. */
export function isStreetGlovePin(pin: { id?: string; dropKind?: string; questRole?: string }): boolean {
  const role = (pin.questRole || "").toLowerCase()
  const kind = (pin.dropKind || "").toLowerCase()
  return kind === "glove" || role === "glove" || (pin.id || "").toLowerCase().startsWith("glove-")
}

/** Park sit: dwell, then themed SPL, then STAR. */
export function isSitPin(pin: { id?: string; dropKind?: string; questRole?: string }): boolean {
  const role = (pin.questRole || "").toLowerCase()
  const kind = (pin.dropKind || "").toLowerCase()
  return kind === "sit" || role === "sit" || (pin.id || "").toLowerCase().startsWith("sit-")
}

export function isWalletCollectiblePin(pin: {
  id?: string
  dropKind?: string
  questRole?: string
}): boolean {
  return isStreetGlovePin(pin) || isSitPin(pin)
}

export type CollectibleMintSpec = {
  kind: "glove" | "sit"
  symbol: string
  title: string
  description: string
  imageUrl: string
  trailPinId: string
  questRole: string
}

export function collectibleMintSpec(
  pin: Pick<TrailPin, "id" | "title" | "notes" | "narrationText" | "lat" | "lon" | "imageUrl" | "dropKind" | "questRole">,
  fallbackImageUrl: string,
): CollectibleMintSpec | { error: string } {
  if (!pin.id) return { error: "Pin id required" }
  const sit = isSitPin(pin)
  const glove = isStreetGlovePin(pin)
  if (!sit && !glove) return { error: "Pin is not a wallet collectible" }
  const symbol = (noteTag(pin.notes, "nftSymbol") || (sit ? "" : "GLOVE")).toUpperCase()
  if (!symbol) return { error: "Sit pin is missing nftSymbol" }
  const httpsImage = noteTag(pin.notes, "nftImageUrl")
  const image =
    (httpsImage.startsWith("http") ? httpsImage : "") ||
    (pin.imageUrl.startsWith("http") ? pin.imageUrl : "") ||
    fallbackImageUrl
  if (!image) return { error: sit ? "Sit image URL is missing" : "Glove image URL is missing" }
  const kind = sit ? "sit" : "glove"
  const desc = [
    pin.narrationText || pin.notes || (sit ? "Field Guide sit" : "JAB street glove"),
    `trailPinId=${pin.id}`,
    Number.isFinite(pin.lat) ? `lat=${pin.lat}` : "",
    Number.isFinite(pin.lon) ? `lon=${pin.lon}` : "",
  ]
    .filter(Boolean)
    .join("\n")
  return {
    kind,
    symbol,
    title: (pin.title || pin.id).trim(),
    description: desc,
    imageUrl: image,
    trailPinId: pin.id,
    questRole: sit ? "sit" : "glove",
  }
}
