import type { HttpClient } from "./http.js"
import { isErrorBody, oasisUrl, readBool, readString, requestJson, unwrapResult } from "./http.js"
import type { SessionApi } from "./session.js"

const SOLANA_PROVIDER = "SolanaOASIS"
/** BSON / Launchboard numeric key for SolanaOASIS. */
const SOLANA_NUMERIC_KEY = "3"

export function isUsableSolanaAddress(address: string): boolean {
  const t = address.trim()
  if (t.length < 32 || t.length > 48) return false
  if (t.startsWith("0x") || t.startsWith("0X")) return false
  if (/^76a914[a-fA-F0-9]+88ac$/i.test(t)) return false
  return true
}

function addressFromWalletNode(node: unknown): string {
  if (typeof node === "string") return node.trim()
  return readString(
    node,
    "walletAddress",
    "WalletAddress",
    "address",
    "Address",
    "publicKey",
    "PublicKey",
  )
}

function guidFromJwt(jwt: string): string {
  try {
    const payload = JSON.parse(
      atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as Record<string, unknown>
    const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const keys = [
      "avatarId",
      "AvatarId",
      "nameid",
      "sub",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    ]
    for (const key of keys) {
      const v = payload[key]
      if (typeof v === "string" && guid.test(v)) return v
    }
    for (const v of Object.values(payload)) {
      if (typeof v === "string" && guid.test(v)) return v
    }
  } catch {
    /* ignore malformed jwt */
  }
  return ""
}

export function pickSolanaFromProviderWallets(wallets: unknown): string {
  if (wallets == null || typeof wallets !== "object") return ""
  const root = wallets as Record<string, unknown>
  const buckets = [root[SOLANA_PROVIDER], root[SOLANA_NUMERIC_KEY], root[3 as unknown as string]]
  for (const bucket of buckets) {
    if (bucket == null) continue
    const items: unknown[] = Array.isArray(bucket)
      ? bucket
      : bucket != null && typeof bucket === "object" && !readString(bucket, "walletAddress", "WalletAddress")
        ? Object.values(bucket as Record<string, unknown>)
        : [bucket]
    let fallback = ""
    for (const item of items) {
      const addr = addressFromWalletNode(item)
      if (!isUsableSolanaAddress(addr)) continue
      if (readBool(item, "isDefaultWallet", "IsDefaultWallet")) return addr
      if (!fallback) fallback = addr
    }
    if (fallback) return fallback
  }
  return ""
}

async function loadAvatar(
  http: HttpClient,
  path: string,
): Promise<Record<string, unknown> | null> {
  const { status, json } = await requestJson(http, oasisUrl(http, path))
  if (status < 200 || status >= 300 || isErrorBody(json).isError) return null
  const avatar = unwrapResult(json)
  return avatar != null && typeof avatar === "object" ? (avatar as Record<string, unknown>) : null
}

function walletFromAvatar(avatar: Record<string, unknown> | null): string {
  if (!avatar) return ""
  return pickSolanaFromProviderWallets(avatar.providerWallets ?? avatar.ProviderWallets)
}

function walletAddressFromKeysResult(json: unknown): string {
  const node = unwrapResult(json)
  return addressFromWalletNode(node)
}

async function provisionSolanaWallet(
  http: HttpClient,
  session: SessionApi,
): Promise<{ ok: boolean; address: string; message: string }> {
  const state = session.get()
  const bodies: { path: string; body: Record<string, string> }[] = []
  if (state.avatarId) {
    bodies.push({
      path: "/api/keys/generate_keypair_with_wallet_address_and_link_provider_keys_to_avatar_by_id",
      body: { AvatarID: state.avatarId, ProviderType: SOLANA_PROVIDER },
    })
  }
  if (state.avatarEmail) {
    bodies.push({
      path: "/api/keys/generate_keypair_with_wallet_address_and_link_provider_keys_to_avatar_by_email",
      body: { AvatarEmail: state.avatarEmail, ProviderType: SOLANA_PROVIDER },
    })
  }
  if (!bodies.length) {
    return { ok: false, address: "", message: "Sign in required to create a Solana wallet" }
  }

  let last = "Wallet provision failed"
  for (const call of bodies) {
    const { status, json, text } = await requestJson(http, oasisUrl(http, call.path), {
      method: "POST",
      body: JSON.stringify(call.body),
    })
    const err = isErrorBody(json)
    if (status >= 200 && status < 300 && !err.isError) {
      const addr = walletAddressFromKeysResult(json)
      if (isUsableSolanaAddress(addr)) return { ok: true, address: addr, message: "" }
      last = "Keys API returned no Solana wallet address"
      continue
    }
    last = err.message || text || `HTTP ${status}`
  }
  return { ok: false, address: "", message: last }
}

/**
 * Unity OasisWalletProvision: read providerWallets (name or numeric key), else Keys generate+link.
 */
export async function ensureSolanaWallet(
  http: HttpClient,
  session: SessionApi,
): Promise<{ ok: boolean; address: string; message: string }> {
  const cached = session.get().solanaWallet
  if (isUsableSolanaAddress(cached)) return { ok: true, address: cached, message: "" }

  let avatarId = session.get().avatarId
  const jwt = session.getJwt() ?? ""
  if (!avatarId && jwt) avatarId = guidFromJwt(jwt)
  if (avatarId && !session.get().avatarId && jwt) {
    session.persistAuth({ jwt, avatarId })
  }

  const tryAvatar = async (path: string): Promise<string> => {
    const avatar = await loadAvatar(http, path)
    if (!avatar) return ""
    const id = readString(avatar, "id", "Id")
    const email = readString(avatar, "email", "Email")
    if ((id || email) && jwt) session.persistAuth({ jwt, avatarId: id || undefined, email: email || undefined })
    return walletFromAvatar(avatar)
  }

  if (avatarId) {
    const existing = await tryAvatar(`/api/avatar/get-by-id/${encodeURIComponent(avatarId)}`)
    if (isUsableSolanaAddress(existing)) {
      session.setSolanaWallet(existing)
      return { ok: true, address: existing, message: "" }
    }
  }

  const fromSession = await tryAvatar("/api/avatar/get-logged-in-avatar")
  if (isUsableSolanaAddress(fromSession)) {
    session.setSolanaWallet(fromSession)
    return { ok: true, address: fromSession, message: "" }
  }

  const created = await provisionSolanaWallet(http, session)
  if (created.ok) {
    session.setSolanaWallet(created.address)
    return created
  }

  const after = session.get().avatarId
  if (after) {
    const existing = await tryAvatar(`/api/avatar/get-by-id/${encodeURIComponent(after)}`)
    if (isUsableSolanaAddress(existing)) {
      session.setSolanaWallet(existing)
      return { ok: true, address: existing, message: "" }
    }
  }

  return created
}
