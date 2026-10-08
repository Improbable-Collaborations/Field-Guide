/** Shared pin contract with Unity TrailPin / Field Guide Lite GeoJSON. */
export type TrailPin = {
  id: string
  title: string
  lat: number
  lon: number
  radiusM: number
  order: number
  questRole: string
  trail: string
  wikiSlug: string
  place: string
  notes: string
  narrationText: string
  directionHint: string
  audioUrl: string
  markerStyle: string
  worldPrefab: string
  /**
   * Trust overlay only: a pin that reached this map through a met peer.
   * peerAvatarId holds the peer's pairwise reference toward this viewer and
   * peerDisplayName the name they chose for this edge. Never a raw avatar id
   * or a profile name. Empty on every other pin.
   */
  trustOrigin: string
  peerDisplayName: string
  peerAvatarId: string
  trustAudience: string
  /** Who published a shared STAR drop. An author, not a trust peer. */
  authorName?: string
  imageUrl: string
  fileUrl: string
  /** drop | guide | power-crystal */
  dropKind: string
  vaultId: string
  temperament: string
  forgeAttestationId: string
  principalNotionalUsd: number
}

export type QuestObjectiveLite = {
  id: string
  /** Pin id. Progress sends this as ItemCollectedName. */
  title: string
  order: number
  isCompleted: boolean
  description: string
  progressSummary: string
  progressPercent: number
}

export type QuestSummary = {
  id: string
  name: string
  description: string
  status: string
  progressPercent: number
  gameSource: string
  externalHandoffUri: string
  trailFile: string
  atmosphere: string
  objectives: QuestObjectiveLite[]
}

export type PlacePinRequest = {
  name: string
  description: string
  latitude: number
  longitude: number
  radiusM?: number
  trailPinId: string
  trail?: string
  questRole?: string
  wikiSlug?: string
  /** Required. Unity has no STAR-only drop path. */
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
}

export type DropSpec = {
  name?: string
  description?: string
  imageUrl?: string
  fileUrl?: string
  kind?: "drop" | "guide" | string
  trailPinId?: string
  latitude?: number
  longitude?: number
}

export type DropResult = {
  ok: boolean
  starPinId: string
  web4Id: string
  tokenAddress: string
  mintHash: string
  walletAddress: string
  message: string
}

export type OasisSessionState = {
  jwt: string
  avatarId: string
  avatarName: string
  avatarEmail: string
  solanaWallet: string
}

export type AuthResult = {
  jwt: string
  avatarId: string
  avatarName: string
  avatarEmail: string
  level: string
}

export type ApiOk = { ok: true; message?: string }
export type ApiFail = { ok: false; message: string }
export type ApiResult = ApiOk | ApiFail

export type PlacePinResult = {
  ok: boolean
  id: string
  message: string
}

export type CheckInResult = {
  ok: boolean
  kind: "shared-drop" | "quest-pin" | "glove" | "sit" | "skipped"
  questId?: string
  started?: boolean
  progressed?: boolean
  completed?: boolean
  mintHash?: string
  tokenAddress?: string
  walletAddress?: string
  message: string
}

export type NearbyArgs = {
  lat: number
  lon: number
  radiusKm: number
  forceRefresh?: boolean
  ttlSec?: number
}
