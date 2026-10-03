import type { OasisSessionState } from "./types.js"

const KEYS = {
  jwt: "fg-web4.jwt",
  avatarId: "fg-web4.avatarId",
  avatarName: "fg-web4.avatarName",
  avatarEmail: "fg-web4.avatarEmail",
  solanaWallet: "fg-web4.solanaWallet",
  needsReauth: "fg-web4.needsReauth",
  startedQuest: "fg-web4.startedQuest",
  checkIns: "fg-web4.checkIns",
  mintedCollectibles: "fg-web4.mintedCollectibles",
  questListCache: "fg-web4.questListCache",
  questListCacheAt: "fg-web4.questListCacheAt",
  questDetailPrefix: "fg-web4.questDetail:",
} as const

function store(storage?: Storage): Storage | null {
  if (storage) return storage
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return globalThis.localStorage
  }
  return null
}

export type SessionApi = {
  hasJwt(): boolean
  getJwt(): string | null
  get(): OasisSessionState
  persistAuth(args: {
    jwt: string
    avatarId?: string
    displayName?: string
    email?: string
  }): void
  setSolanaWallet(address: string): void
  clear(): void
  clearJwtOnly(): void
  markNeedsReauth(): void
  needsReauth(): boolean
  /** Local STAR start latch (Unity PrefStarted). */
  hasStartedLocally(questId: string): boolean
  markStartedLocally(questId: string): void
  isCheckedIn(pinId: string): boolean
  markCheckedIn(pinId: string): void
  checkedInIds(): string[]
  hasMintedCollectible(pinId: string): boolean
  markMintedCollectible(pinId: string): void
  mintedCollectibleIds(): string[]
  getJson(key: string): string | null
  setJson(key: string, value: string): void
  remove(key: string): void
  keys: typeof KEYS
}

function isJwtExpired(jwt: string): boolean {
  try {
    const parts = jwt.split(".")
    if (parts.length < 2) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number
    }
    if (typeof payload.exp !== "number") return false
    return Date.now() / 1000 >= payload.exp - 30
  } catch {
    return false
  }
}

export function createSession(storage?: Storage): SessionApi {
  const s = () => store(storage)

  const api: SessionApi = {
    keys: KEYS,

    hasJwt() {
      const jwt = api.getJwt()
      return Boolean(jwt)
    },

    getJwt() {
      const st = s()
      if (!st) return null
      const jwt = st.getItem(KEYS.jwt) ?? ""
      if (!jwt) return null
      if (isJwtExpired(jwt)) {
        api.clearJwtOnly()
        api.markNeedsReauth()
        return null
      }
      return jwt
    },

    get() {
      const st = s()
      return {
        jwt: api.getJwt() ?? "",
        avatarId: st?.getItem(KEYS.avatarId) ?? "",
        avatarName: st?.getItem(KEYS.avatarName) ?? "",
        avatarEmail: st?.getItem(KEYS.avatarEmail) ?? "",
        solanaWallet: st?.getItem(KEYS.solanaWallet) ?? "",
      }
    },

    persistAuth({ jwt, avatarId, displayName, email }) {
      const st = s()
      if (!st) return
      st.setItem(KEYS.jwt, jwt ?? "")
      st.removeItem(KEYS.needsReauth)
      if (avatarId) st.setItem(KEYS.avatarId, avatarId)
      if (displayName) st.setItem(KEYS.avatarName, displayName)
      if (email) st.setItem(KEYS.avatarEmail, email.trim())
    },

    setSolanaWallet(address: string) {
      const st = s()
      if (!st) return
      st.setItem(KEYS.solanaWallet, address.trim())
    },

    clear() {
      const st = s()
      if (!st) return
      st.removeItem(KEYS.jwt)
      st.removeItem(KEYS.avatarId)
      st.removeItem(KEYS.avatarName)
      st.removeItem(KEYS.avatarEmail)
      st.removeItem(KEYS.needsReauth)
      st.removeItem(KEYS.solanaWallet)
    },

    clearJwtOnly() {
      s()?.removeItem(KEYS.jwt)
    },

    markNeedsReauth() {
      s()?.setItem(KEYS.needsReauth, "1")
    },

    needsReauth() {
      const st = s()
      if (!st) return false
      return !api.hasJwt() && (st.getItem(KEYS.needsReauth) === "1" || Boolean(st.getItem(KEYS.avatarId)))
    },

    hasStartedLocally(questId: string) {
      if (!questId) return false
      return s()?.getItem(KEYS.startedQuest) === questId
    },

    markStartedLocally(questId: string) {
      if (!questId) return
      s()?.setItem(KEYS.startedQuest, questId)
    },

    isCheckedIn(pinId: string) {
      return api.checkedInIds().some((id) => id.toLowerCase() === pinId.toLowerCase())
    },

    markCheckedIn(pinId: string) {
      if (!pinId) return
      const ids = api.checkedInIds()
      if (ids.some((id) => id.toLowerCase() === pinId.toLowerCase())) return
      ids.push(pinId)
      s()?.setItem(KEYS.checkIns, JSON.stringify(ids))
    },

    checkedInIds() {
      const raw = s()?.getItem(KEYS.checkIns)
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed) ? parsed.map(String) : []
      } catch {
        return []
      }
    },

    hasMintedCollectible(pinId: string) {
      return api.mintedCollectibleIds().some((id) => id.toLowerCase() === pinId.toLowerCase())
    },

    markMintedCollectible(pinId: string) {
      if (!pinId) return
      const ids = api.mintedCollectibleIds()
      if (ids.some((id) => id.toLowerCase() === pinId.toLowerCase())) return
      ids.push(pinId)
      s()?.setItem(KEYS.mintedCollectibles, JSON.stringify(ids))
    },

    mintedCollectibleIds() {
      const raw = s()?.getItem(KEYS.mintedCollectibles)
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed) ? parsed.map(String) : []
      } catch {
        return []
      }
    },

    getJson(key: string) {
      return s()?.getItem(key) ?? null
    },

    setJson(key: string, value: string) {
      s()?.setItem(key, value)
    },

    remove(key: string) {
      s()?.removeItem(key)
    },
  }

  return api
}
