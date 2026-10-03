export const DEFAULT_OASIS_BASE_URL =
  "https://motivated-reflection-production-457c.up.railway.app"

export const DEFAULT_STAR_BASE_URL =
  "https://oasis-star-api-production.up.railway.app"

export const DEFAULT_NUVA_BASE_URL = "https://app.nuva.finance"

export type FieldGuideWeb4ClientConfig = {
  oasisBaseUrl: string
  starBaseUrl: string
  nuvaBaseUrl?: string
  configuredQuestId?: string
  dropNftImageUrl?: string
  /** HTTPS image used when minting a street glove into the avatar wallet. */
  gloveNftImageUrl?: string
  solanaCluster?: string
  allowInGameDrop?: boolean
  /** Unity uses field-guide-unity; browser default field-guide-web. */
  source?: string
  /**
   * Base URL for Unity StreamingAssets mirrors (`quest-packs/`, `trails/`).
   * Example: "" or "." when served from field-guide-web dist root;
   * or absolute CDN / Vite public URL.
   */
  contentBaseUrl?: string
  listCacheTtlSeconds?: number
  nearbyCacheTtlSeconds?: number
  storage?: Storage
  fetch?: typeof fetch
}

export function resolveConfig(
  partial: Partial<FieldGuideWeb4ClientConfig> = {},
): FieldGuideWeb4ClientConfig {
  return {
    oasisBaseUrl: (partial.oasisBaseUrl ?? DEFAULT_OASIS_BASE_URL).replace(/\/$/, ""),
    starBaseUrl: (partial.starBaseUrl ?? DEFAULT_STAR_BASE_URL).replace(/\/$/, ""),
    nuvaBaseUrl: (partial.nuvaBaseUrl ?? DEFAULT_NUVA_BASE_URL).replace(/\/$/, ""),
    configuredQuestId: partial.configuredQuestId ?? "",
    dropNftImageUrl:
      partial.dropNftImageUrl ??
      "https://via.placeholder.com/512/111111/FFD400?text=FIELD+DROP",
    gloveNftImageUrl:
      partial.gloveNftImageUrl ??
      "https://via.placeholder.com/512/111111/E8523A?text=JAB+GLOVE",
    solanaCluster: partial.solanaCluster ?? "devnet",
    allowInGameDrop: partial.allowInGameDrop ?? true,
    source: partial.source ?? "field-guide-web",
    contentBaseUrl: partial.contentBaseUrl ?? "",
    listCacheTtlSeconds: partial.listCacheTtlSeconds ?? 120,
    nearbyCacheTtlSeconds: partial.nearbyCacheTtlSeconds ?? 600,
    storage: partial.storage,
    fetch: partial.fetch,
  }
}
