import { createAuthApi } from "./auth.js"
import { createCheckInApi } from "./checkIn.js"
import {
  resolveConfig,
  type FieldGuideWeb4ClientConfig,
} from "./config.js"
import { createContentApi } from "./content.js"
import { createDropsApi } from "./drops.js"
import { createGeoApi } from "./geo.js"
import type { HttpClient } from "./http.js"
import { createQuestsApi } from "./quests.js"
import { createSession } from "./session.js"
import { ensureSolanaWallet } from "./wallet.js"

export type FieldGuideWeb4Client = ReturnType<typeof createFieldGuideWeb4Client>

/**
 * Browser client for Field Guide / AR World shared backend
 * (ONODE WEB4 + STAR WEB5), mirrored from Unity clients in _inspect_ARWorld.
 */
export function createFieldGuideWeb4Client(
  partial: Partial<FieldGuideWeb4ClientConfig> = {},
) {
  const config = resolveConfig(partial)
  const session = createSession(config.storage)
  const fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis)

  const http: HttpClient = {
    config,
    fetch: fetchImpl,
    getJwt: () => session.getJwt(),
    onUnauthorized: () => {
      session.clearJwtOnly()
      session.markNeedsReauth()
    },
  }

  const auth = createAuthApi(http, session)
  const quests = createQuestsApi(http, session, config)
  const geo = createGeoApi(http, config)
  const drops = createDropsApi(http, session, config, geo)
  const checkIn = createCheckInApi(session, config, quests, geo, drops)
  const content = createContentApi(config)

  return {
    config,
    session: {
      hasJwt: () => session.hasJwt(),
      getJwt: () => session.getJwt(),
      get: () => session.get(),
      persistAuth: session.persistAuth,
      setSolanaWallet: session.setSolanaWallet,
      clear: () => session.clear(),
      needsReauth: () => session.needsReauth(),
      isCheckedIn: (pinId: string) => session.isCheckedIn(pinId),
      markCheckedIn: (pinId: string) => session.markCheckedIn(pinId),
      checkedInIds: () => session.checkedInIds(),
      hasMintedCollectible: (pinId: string) => session.hasMintedCollectible(pinId),
      mintedCollectibleIds: () => session.mintedCollectibleIds(),
    },
    wallet: {
      ensure: () => ensureSolanaWallet(http, session),
    },
    auth,
    quests,
    geo,
    drops,
    checkIn,
    /** Unity StreamingAssets: quest-packs + trails (+ catalog merge). */
    content,
  }
}
