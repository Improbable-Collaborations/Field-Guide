import {
  createFieldGuideWeb4Client,
  isSitPin,
  isStreetGlovePin,
  OASIS_NATIVE_TOKENS_NOTE,
  OASIS_SESSION_EXPIRED_MESSAGE,
  type OasisWalletNft,
  type SolanaWalletRead,
} from "field-guide-web4-client"
import { maskWallet, type ProfileSnapshot } from "../profile/model"
import { JAB_SW1_GLOVES_QUEST_ID } from "../quests/jabSw1Gloves"
import { loadAvatarGuide } from "./loadAvatarGuide"
import { loadAuthoredTrailPins } from "./loadTrailPins"
import { memoryStorage } from "./memoryStorage"
import { PLACES } from "../places"

export { OASIS_SESSION_EXPIRED_MESSAGE }

export type FieldGuideWalletExperience = {
  pinId: string
  kind: "glove" | "sit" | "check-in"
  minted: boolean
  starCompleted: boolean
}

export type FieldGuideWalletContent = {
  avatarId: string
  avatarName: string
  provider: "SolanaOASIS"
  cluster: string
  address: string | null
  addressMasked: string
  nativeBalance: number | null
  nativeSymbol: string | null
  tokensNote: string
  nfts: OasisWalletNft[]
  fieldGuide: {
    collectedPinIds: string[]
    mintedGlovePinIds: string[]
    experiences: FieldGuideWalletExperience[]
  } | null
  error?: boolean
  message?: string
}

export function mintedGlovePinIdsFromNfts(nfts: OasisWalletNft[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const nft of nfts) {
    const pinId = nft.trailPinId.trim()
    const glove = nft.symbol.trim().toUpperCase() === "GLOVE"
    if (!pinId && !glove) continue
    if (pinId) {
      const key = pinId.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      ids.push(pinId)
    }
  }
  return ids
}

export function mapFieldGuideWallet(args: {
  read: SolanaWalletRead
  cluster: string
  snap?: ProfileSnapshot | null
  includeFieldGuide: boolean
  includeNfts: boolean
}): FieldGuideWalletContent {
  const { read, cluster, snap, includeFieldGuide, includeNfts } = args
  const address = read.address
  const nfts = includeNfts ? read.nfts : []
  const mintedGlovePinIds = mintedGlovePinIdsFromNfts(nfts)
  const mintedSet = new Set(mintedGlovePinIds.map((id) => id.toLowerCase()))
  const pins = loadAuthoredTrailPins(PLACES)
  const collectedPinIds = snap?.experiences.map((e) => e.pinId) ?? []
  const collectedSet = new Set(collectedPinIds.map((id) => id.toLowerCase()))

  const experienceIds = [...new Set([...collectedPinIds, ...mintedGlovePinIds])]
  const experiences: FieldGuideWalletExperience[] = experienceIds.map((pinId) => {
    const pin = pins.find((p) => p.id === pinId)
    const glove = pin ? isStreetGlovePin(pin) : mintedSet.has(pinId.toLowerCase()) && pinId.toLowerCase().startsWith("glove-")
    const sit = pin ? isSitPin(pin) : pinId.toLowerCase().startsWith("sit-")
    return {
      pinId,
      kind: glove ? "glove" : sit ? "sit" : "check-in",
      minted: mintedSet.has(pinId.toLowerCase()),
      starCompleted: collectedSet.has(pinId.toLowerCase()),
    }
  })

  const messageParts: string[] = []
  if (read.message) messageParts.push(read.message)
  if (read.nftError) messageParts.push(read.nftError)

  return {
    avatarId: read.avatarId,
    avatarName: read.avatarName,
    provider: "SolanaOASIS",
    cluster,
    address,
    addressMasked: address ? maskWallet(address) : "",
    nativeBalance: read.nativeBalance,
    nativeSymbol: read.nativeSymbol,
    tokensNote: read.tokensNote || OASIS_NATIVE_TOKENS_NOTE,
    nfts,
    fieldGuide: includeFieldGuide
      ? { collectedPinIds, mintedGlovePinIds, experiences }
      : null,
    ...(messageParts.length ? { message: messageParts.join(" ") } : {}),
  }
}

export function fieldGuideWalletChatText(content: FieldGuideWalletContent): string {
  if (content.error && content.message) return content.message
  if (!content.address) {
    return (
      content.message
      || "No Solana OASIS wallet on this avatar. Create one on Field Guide You (ensureWallet)."
    )
  }
  const who = content.avatarName || "this avatar"
  const bal =
    content.nativeBalance == null
      ? "native balance unknown"
      : `${content.nativeBalance} ${content.nativeSymbol || "native"}`
  const gloves = content.nfts.filter(
    (n) => n.symbol.toUpperCase() === "GLOVE" || Boolean(n.trailPinId),
  ).length
  const nftBit = content.nfts.length
    ? `${content.nfts.length} OASIS NFT${content.nfts.length === 1 ? "" : "s"} (${gloves} glove/trail).`
    : "No OASIS NFTs returned."
  const lag = content.message ? ` ${content.message}` : ""
  return `Solana OASIS wallet ${content.addressMasked} on ${who} (${content.cluster}). ${bal}. ${nftBit}${lag}`
}

function boolArg(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

export async function fieldGuideWalletToolResult(
  jwt: string,
  args: Record<string, unknown>,
): Promise<{
  content: [{ type: "text"; text: string }]
  structuredContent: FieldGuideWalletContent
  isError?: boolean
}> {
  const includeNfts = boolArg(args.includeNfts, true)
  const includeFieldGuide = boolArg(args.includeFieldGuide, true)
  const client = createFieldGuideWeb4Client({
    storage: memoryStorage({ "fg-web4.jwt": jwt }),
    listCacheTtlSeconds: 0,
    configuredQuestId: JAB_SW1_GLOVES_QUEST_ID,
    source: "field-guide-mcp",
  })
  const read = await client.wallet.read({ includeNfts })
  if (read.expired || (read.isError && !read.address && !read.avatarId)) {
    const message = read.message || OASIS_SESSION_EXPIRED_MESSAGE
    const structured: FieldGuideWalletContent = {
      avatarId: read.avatarId,
      avatarName: read.avatarName,
      provider: "SolanaOASIS",
      cluster: client.config.solanaCluster ?? "devnet",
      address: null,
      addressMasked: "",
      nativeBalance: null,
      nativeSymbol: null,
      tokensNote: OASIS_NATIVE_TOKENS_NOTE,
      nfts: [],
      fieldGuide: includeFieldGuide
        ? { collectedPinIds: [], mintedGlovePinIds: [], experiences: [] }
        : null,
      error: true,
      message,
    }
    return {
      content: [{ type: "text", text: message }],
      structuredContent: structured,
      isError: true,
    }
  }
  if (read.isError) {
    const structured = mapFieldGuideWallet({
      read,
      cluster: client.config.solanaCluster ?? "devnet",
      snap: null,
      includeFieldGuide,
      includeNfts,
    })
    structured.error = true
    structured.message = read.message
    return {
      content: [{ type: "text", text: read.message }],
      structuredContent: structured,
      isError: true,
    }
  }

  let snap: ProfileSnapshot | null = null
  if (includeFieldGuide) {
    snap = await loadAvatarGuide(jwt)
  }
  const structured = mapFieldGuideWallet({
    read,
    cluster: client.config.solanaCluster ?? "devnet",
    snap,
    includeFieldGuide,
    includeNfts,
  })
  return {
    content: [{ type: "text", text: fieldGuideWalletChatText(structured) }],
    structuredContent: structured,
  }
}
