import type { HttpClient } from "./http.js"
import {
  isErrorBody,
  oasisUrl,
  readNumber,
  readString,
  requestJson,
  unwrapResult,
} from "./http.js"
import type { SessionApi } from "./session.js"
import {
  isUsableSolanaAddress,
  pickSolanaFromProviderWallets,
  pickSolanaWalletRecord,
  type SolanaWalletRecord,
} from "./wallet.js"

export const OASIS_SESSION_EXPIRED_MESSAGE =
  "OASIS session expired. Sign in to Field Guide MCP again."

export const OASIS_NATIVE_TOKENS_NOTE =
  "OASIS GET /api/wallet/.../tokens returns native chain balance only. SPL and ERC-20 lists need a block-explorer integration."

export type OasisWalletNft = {
  title: string
  symbol: string
  tokenAddress: string
  mintHash: string
  trailPinId: string
  web4Id: string
}

export type SolanaWalletRead = {
  expired: boolean
  isError: boolean
  message: string
  avatarId: string
  avatarName: string
  address: string | null
  walletId: string
  nativeBalance: number | null
  nativeSymbol: string | null
  tokensNote: string
  nfts: OasisWalletNft[]
  nftError: string
}

function metaRecord(node: unknown): Record<string, unknown> {
  if (node == null || typeof node !== "object") return {}
  const rec = node as Record<string, unknown>
  const meta = rec.metaData ?? rec.MetaData
  if (meta && typeof meta === "object" && !Array.isArray(meta)) return meta as Record<string, unknown>
  return {}
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key] ?? meta[key[0]?.toUpperCase() + key.slice(1)]
  if (v == null) return ""
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (typeof v === "object" && v && "value" in v) return String((v as { value: unknown }).value ?? "").trim()
  return ""
}

function nftKey(nft: OasisWalletNft): string {
  return (nft.web4Id || nft.tokenAddress || nft.mintHash || nft.trailPinId).toLowerCase()
}

export function parseOasisNftNode(node: unknown): OasisWalletNft | null {
  if (node == null || typeof node !== "object") return null
  const rec = node as Record<string, unknown>
  const meta = metaRecord(rec)
  const nestedWeb3 = rec.web3NFTs ?? rec.Web3NFTs ?? rec.newlyMintedWeb3NFTs ?? rec.NewlyMintedWeb3NFTs
  const firstWeb3 = Array.isArray(nestedWeb3) && nestedWeb3[0] && typeof nestedWeb3[0] === "object"
    ? (nestedWeb3[0] as Record<string, unknown>)
    : null
  const nft: OasisWalletNft = {
    title: readString(rec, "title", "Title", "name", "Name"),
    symbol: readString(rec, "symbol", "Symbol") || readString(firstWeb3, "symbol", "Symbol"),
    tokenAddress:
      readString(rec, "nftTokenAddress", "NFTTokenAddress", "tokenAddress", "TokenAddress")
      || readString(firstWeb3, "nftTokenAddress", "NFTTokenAddress", "tokenAddress", "TokenAddress"),
    mintHash:
      readString(rec, "mintTransactionHash", "MintTransactionHash", "hash", "Hash", "mintHash", "MintHash")
      || readString(firstWeb3, "mintTransactionHash", "MintTransactionHash", "hash", "Hash"),
    trailPinId: metaString(meta, "trailPinId") || metaString(meta, "TrailPinId"),
    web4Id: readString(rec, "id", "Id", "web4NFTId", "Web4NFTId"),
  }
  if (!nft.title && !nft.symbol && !nft.tokenAddress && !nft.mintHash && !nft.trailPinId && !nft.web4Id) {
    return null
  }
  return nft
}

export function parseOasisNftList(json: unknown): OasisWalletNft[] {
  const node = unwrapResult(json)
  const list = Array.isArray(node) ? node : node == null ? [] : [node]
  const out: OasisWalletNft[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const nft = parseOasisNftNode(item)
    if (!nft) continue
    const key = nftKey(nft)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(nft)
  }
  return out
}

export function mergeOasisNfts(...lists: OasisWalletNft[][]): OasisWalletNft[] {
  const out: OasisWalletNft[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const nft of list) {
      const key = nftKey(nft)
      if (key && seen.has(key)) continue
      if (key) seen.add(key)
      out.push(nft)
    }
  }
  return out
}

function nativeFromTokens(json: unknown): { balance: number | null; symbol: string | null } {
  const node = unwrapResult(json)
  const list = Array.isArray(node) ? node : []
  const native =
    list.find((item) => {
      if (item == null || typeof item !== "object") return false
      const rec = item as Record<string, unknown>
      return rec.isNative === true || rec.IsNative === true
    }) ?? (list.length === 1 ? list[0] : undefined)
  if (native == null || typeof native !== "object") return { balance: null, symbol: null }
  const rec = native as Record<string, unknown>
  const balance = readNumber(rec, "balance", "Balance", "amount", "Amount")
  const symbol = readString(rec, "symbol", "Symbol")
  return {
    balance: Number.isFinite(balance) ? balance : null,
    symbol: symbol || null,
  }
}

async function oasisGet(
  http: HttpClient,
  path: string,
): Promise<{ status: number; json: unknown; err: { isError: boolean; message: string } }> {
  const { status, json, text } = await requestJson(http, oasisUrl(http, path))
  const err = isErrorBody(json)
  if (!err.isError && (status < 200 || status >= 300)) {
    return { status, json, err: { isError: true, message: text || `HTTP ${status}` } }
  }
  if (err.isError && !err.message) {
    return { status, json, err: { isError: true, message: text || `HTTP ${status}` } }
  }
  return { status, json, err }
}

/**
 * Read-only: logged-in avatar Solana OASIS wallet and OASIS NFT holdings.
 * Does not call ensureSolanaWallet / Keys generate.
 */
export async function readSolanaWallet(
  http: HttpClient,
  session: SessionApi,
  opts: { includeNfts?: boolean } = {},
): Promise<SolanaWalletRead> {
  const includeNfts = opts.includeNfts !== false
  const empty: SolanaWalletRead = {
    expired: false,
    isError: false,
    message: "",
    avatarId: "",
    avatarName: "",
    address: null,
    walletId: "",
    nativeBalance: null,
    nativeSymbol: null,
    tokensNote: OASIS_NATIVE_TOKENS_NOTE,
    nfts: [],
    nftError: "",
  }

  if (!session.getJwt()) {
    return { ...empty, expired: true, isError: true, message: OASIS_SESSION_EXPIRED_MESSAGE }
  }

  const avatarRes = await oasisGet(http, "/api/avatar/get-logged-in-avatar")
  if (avatarRes.status === 401) {
    return { ...empty, expired: true, isError: true, message: OASIS_SESSION_EXPIRED_MESSAGE }
  }
  if (avatarRes.err.isError) {
    return {
      ...empty,
      isError: true,
      message: avatarRes.err.message || "OASIS could not load the logged-in avatar.",
    }
  }

  const avatar = unwrapResult(avatarRes.json)
  const rec = avatar && typeof avatar === "object" ? (avatar as Record<string, unknown>) : {}
  const avatarId = readString(rec, "id", "Id")
  const avatarName = readString(rec, "username", "Username", "name", "Name")
  const jwt = session.getJwt()
  if (avatarId && jwt) session.persistAuth({ jwt, avatarId, displayName: avatarName || undefined })

  const fromAvatar = pickSolanaFromProviderWallets(rec.providerWallets ?? rec.ProviderWallets)
  let record: SolanaWalletRecord | null = fromAvatar
    ? { id: "", address: fromAvatar, balance: null }
    : null

  if (avatarId) {
    const walletsRes = await oasisGet(
      http,
      `/api/wallet/avatar/${encodeURIComponent(avatarId)}/wallets/false/false`,
    )
    if (walletsRes.status === 401) {
      return { ...empty, expired: true, isError: true, message: OASIS_SESSION_EXPIRED_MESSAGE }
    }
    if (!walletsRes.err.isError) {
      const fromWallets = pickSolanaWalletRecord(unwrapResult(walletsRes.json))
      if (fromWallets) {
        record = {
          id: fromWallets.id || record?.id || "",
          address: fromWallets.address || record?.address || fromAvatar,
          balance: fromWallets.balance,
        }
      }
    } else if (!record) {
      return {
        ...empty,
        avatarId,
        avatarName,
        isError: true,
        message: walletsRes.err.message || "OASIS could not load Solana wallets.",
      }
    }

    const defaultRes = await oasisGet(
      http,
      `/api/wallet/avatar/${encodeURIComponent(avatarId)}/default-wallet?providerType=SolanaOASIS`,
    )
    if (defaultRes.status === 401) {
      return { ...empty, expired: true, isError: true, message: OASIS_SESSION_EXPIRED_MESSAGE }
    }
    if (!defaultRes.err.isError) {
      const def = pickSolanaWalletRecord({ SolanaOASIS: [unwrapResult(defaultRes.json)] })
      if (def && isUsableSolanaAddress(def.address)) {
        record = {
          id: def.id || record?.id || "",
          address: def.address,
          balance: def.balance ?? record?.balance ?? null,
        }
      }
    }
  }

  const address = record && isUsableSolanaAddress(record.address) ? record.address : null
  const walletId = record?.id || ""
  let nativeBalance = record?.balance ?? null
  let nativeSymbol: string | null = null
  let message = ""

  if (address && avatarId && walletId) {
    const tokensRes = await oasisGet(
      http,
      `/api/wallet/avatar/${encodeURIComponent(avatarId)}/wallet/${encodeURIComponent(walletId)}/tokens`,
    )
    if (tokensRes.status === 401) {
      return { ...empty, expired: true, isError: true, message: OASIS_SESSION_EXPIRED_MESSAGE }
    }
    if (tokensRes.err.isError) {
      message = tokensRes.err.message
    } else {
      const native = nativeFromTokens(tokensRes.json)
      if (native.balance != null) nativeBalance = native.balance
      nativeSymbol = native.symbol
    }
  }

  let nfts: OasisWalletNft[] = []
  let nftError = ""
  if (includeNfts && avatarId) {
    const web4 = await oasisGet(
      http,
      `/api/nft/load-all-nfts-for_avatar/${encodeURIComponent(avatarId)}`,
    )
    if (web4.status === 401) {
      return { ...empty, expired: true, isError: true, message: OASIS_SESSION_EXPIRED_MESSAGE }
    }
    const web3 = await oasisGet(
      http,
      `/api/nft/load-all-web3-nfts-for-avatar/${encodeURIComponent(avatarId)}`,
    )
    if (web3.status === 401) {
      return { ...empty, expired: true, isError: true, message: OASIS_SESSION_EXPIRED_MESSAGE }
    }
    const parts: OasisWalletNft[] = []
    const errors: string[] = []
    if (!web4.err.isError) parts.push(...parseOasisNftList(web4.json))
    else errors.push(web4.err.message || "load-all-nfts-for_avatar failed")
    if (!web3.err.isError) parts.push(...parseOasisNftList(web3.json))
    else errors.push(web3.err.message || "load-all-web3-nfts-for-avatar failed")
    nfts = mergeOasisNfts(parts)
    if (errors.length) nftError = errors.join(" ")
  }

  if (!address) {
    message =
      "No Solana OASIS wallet on this avatar. Create one on Field Guide You (ensureWallet)."
  }

  return {
    expired: false,
    isError: false,
    message,
    avatarId,
    avatarName,
    address,
    walletId,
    nativeBalance,
    nativeSymbol,
    tokensNote: OASIS_NATIVE_TOKENS_NOTE,
    nfts,
    nftError,
  }
}
