export {
  createFieldGuideWeb4Client,
  type FieldGuideWeb4Client,
} from "./createClient.js"

export {
  resolveConfig,
  DEFAULT_OASIS_BASE_URL,
  DEFAULT_STAR_BASE_URL,
  DEFAULT_NUVA_BASE_URL,
  type FieldGuideWeb4ClientConfig,
} from "./config.js"

export { parseNearbyJson } from "./geo.js"
export { parseQuestNode } from "./quests.js"
export { isSitPin, isStreetGlovePin, isWalletCollectiblePin } from "./checkIn.js"
export { collectibleMintSpec, noteTag } from "./collectibleMint.js"
export { unwrapResult, isErrorBody } from "./http.js"
export {
  pickSolanaFromProviderWallets,
  pickSolanaWalletRecord,
  isUsableSolanaAddress,
} from "./wallet.js"
export {
  readSolanaWallet,
  parseOasisNftList,
  parseOasisNftNode,
  mergeOasisNfts,
  OASIS_SESSION_EXPIRED_MESSAGE,
  OASIS_NATIVE_TOKENS_NOTE,
  type OasisWalletNft,
  type SolanaWalletRead,
} from "./walletRead.js"
export {
  KNOWN_QUEST_PACK_FILES,
  parseQuestPackJson,
  parseQuestPackMeta,
  parseTrailCatalog,
  pinsFromGeoJson,
  mergeQuestsWithLocalPacks,
  resolveSpawn,
  type TrailCatalogEntry,
  type QuestPackMeta,
  type QuestPackSpawn,
} from "./questPacks.js"
export { createContentApi, type ContentApi } from "./content.js"

export type {
  TrailPin,
  QuestObjectiveLite,
  QuestSummary,
  PlacePinRequest,
  DropSpec,
  DropResult,
  OasisSessionState,
  AuthResult,
  ApiResult,
  PlacePinResult,
  CheckInResult,
  NearbyArgs,
} from "./types.js"
