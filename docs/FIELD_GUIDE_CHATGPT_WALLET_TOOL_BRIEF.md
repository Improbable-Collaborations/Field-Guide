# Field Guide ChatGPT: `field_guide_wallet` brief

Paste this into a new chat:

> Implement Field Guide ChatGPT wallet tools per `Docs/Devs/FIELD_GUIDE_CHATGPT_WALLET_TOOL_BRIEF.md`. Read `Docs/Devs/AGENT_Root_Cause_No_Fallbacks.md` first. Do not change the ChatGPT MCP path.

---

## Goal

ChatGPT, signed in as the visitor’s OASIS avatar through Field Guide MCP OAuth, should be able to **inspect that avatar’s OASIS Solana wallet** after a quest check-in: address, provider/chain, native balance, Field Guide / STAR collectibles, and on-chain NFTs when OASIS returns them.

**Phase 1 (this brief):** one read-only tool `field_guide_wallet`.

**Phase 2 (later, not this PR):** send/transfer with explicit confirmation. Do not start Phase 2 until Phase 1 is live and ChatGPT can see a glove mint.

---

## Why ChatGPT asked for this

ChatGPT inspected the live connector and proposed a wallet tool. Parts of that analysis are true. Parts are guesses. Implement against **code**, not the chat transcript.

### True

- The OASIS Solana wallet is bound to the avatar (`providerWallets` / BSON key `"3"` = `SolanaOASIS`). Field Guide already resolves it with `pickSolanaFromProviderWallets`. ChatGPT does not need the visitor to paste an address.
- **JAB SW1 Street Gloves** check-in is GPS → JWT → `POST /api/nft/mint-nft` (`Symbol: GLOVE`) into that wallet → STAR progress. Pin id = STAR objective title = NFT `MetaData.trailPinId`.
- Field Guide MCP has **no** wallet tool today. Tools are context, progress, map, Look, check-in, drop photo.
- `field_guide_progress` currently JSON-dumps `ProfileSnapshot`, which includes the **full** Solana address. `field_guide_context` only prints a **masked** address via `maskWallet`.

### Not true / do not encode as product truth

- Hitchhiker Stoop `minted: false` is **not** “STAR vs chain ownership”. MCP sets `mintedIds` to collected ids that start with `glove-` (`loadAvatarGuide.ts`). Stoop / park beacons are STAR-only (`checkIn.handle` `kind: "quest-pin"`). They never mint. `minted: false` is expected.
- Park-circuit copy in `places.ts` still says “same JWT mint then STAR”. That is stale vs `checkIn.ts`. Gloves mint. Stoop and park beacons do not.
- There is no Field Guide tool for balance, SPL token lists, tx history, send, or provider switching. OASIS **does** have those HTTP routes. Wire Phase 1 through `field-guide-web4-client` + those routes. Do not invent a second client or call Cursor’s OASIS MCP from this server.
- `GET /api/wallet/.../tokens` currently returns **native balance only**. Comment in `WalletController.GetWalletTokensAsync`: SPL / ERC-20 lists need a real explorer integration. Do not fake a token list.

---

## Live stack (do not redesign)

| Piece | Where |
|-------|--------|
| Field Guide app + MCP | `field-guide/finsbury-guide` (Vite 5179, MCP 8788) |
| ChatGPT connector URL | `{publicOrigin}/mcp` only. Aliases `/mcp/map-layers`, `/mcp/map-ui` already exist. **Never bump the path.** ChatGPT caches tools per URL. |
| OAuth | `src/mcp/oauth.ts`. ChatGPT holds `fgat_*` (7 days). That row wraps an **OASIS JWT** (~hours). Expired OASIS JWT → `OASIS session expired. Sign in to Field Guide MCP again.` Refresh of `fgat_*` re-wraps the **same stale JWT**. Fix is re-authorize on the Field Guide OASIS page, not a new connector. |
| Web4 client | `Web4/clients/field-guide-web4-client` (`file:` dep). OASIS `https://motivated-reflection-production-457c.up.railway.app`, STAR `https://oasis-star-api-production.up.railway.app`, Solana cluster default **devnet**. |
| Collect | `client.checkIn.handle(pin, { questId })` in `checkIn.ts`. MCP wraps it in `src/mcp/checkInAtPin.ts`. |
| You desk wallet button | `client.wallet.ensure()` → `ensureSolanaWallet` (read `providerWallets`, else Keys generate+link). |

Quests:

- Hitchhiker Stoop `e86e2c7d-7cdd-4542-b82d-7d1bd27b46df` pin `hitchhiker-stoop` (STAR only, smoke test).
- Finsbury Park Circuit `783700a0-5f6f-4861-993b-7c1ff76b3a26` (STAR only).
- JAB SW1 gloves `8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22` (mint then STAR).

Policy: `Docs/Devs/AGENT_Root_Cause_No_Fallbacks.md`. One collect path. No dual mint. No silent catch. Surface `OASISResult` / real errors.

---

## Invariant (Phase 1)

`field_guide_wallet` returns the **logged-in avatar’s** default Solana OASIS wallet and OASIS-backed holdings for that avatar. It must not:

- accept a wallet address as input (identity comes from the JWT)
- decrypt or return private keys (`decryptPrivateKeys` stays false)
- create a wallet on a read call (`ensureSolanaWallet` provisions if missing; **do not call that from the read tool**)
- mint, send, switch provider, or mark a pin collected
- invent SPL token rows when OASIS only returns native balance
- treat STAR check-in as on-chain ownership

If there is no Solana wallet on the avatar, return that clearly (`wallet: null`) and tell ChatGPT the visitor can create one on Field Guide You (`ensureWallet`). Do not provision from ChatGPT in Phase 1.

---

## Phase 1: `field_guide_wallet`

Add the tool in `field-guide/finsbury-guide/src/mcp/createServer.ts` (`fieldGuideTools` + `CallToolRequestSchema`). Keep `name` stable: `field_guide_wallet`.

Suggested input (all optional):

- `includeNfts` (bool, default true)
- `includeFieldGuide` (bool, default true): STAR-collected pins vs glove mints from `loadAvatarGuide` / `isStreetGlovePin`
- no `avatarId`, no `address`

Suggested `structuredContent` (camelCase, one object):

- `avatarId`, `avatarName`
- `provider`: `SolanaOASIS`
- `cluster`: from client config (`devnet` unless overridden)
- `address`: full Solana address or null
- `addressMasked`: `maskWallet(address)` for chat prose
- `nativeBalance`: number or null, plus `nativeSymbol` if OASIS gives it
- `tokensNote`: if OASIS tokens endpoint is native-only, say so in one sentence
- `nfts`: array of `{ title, symbol, tokenAddress, mintHash, trailPinId, web4Id }` from OASIS NFT load APIs, filtered/annotated when `MetaData.trailPinId` or `Symbol === GLOVE`
- `fieldGuide`: `{ collectedPinIds, mintedGlovePinIds, experiences: [{ pinId, kind, minted, starCompleted }] }`
- `error` / `message` on failure (expired JWT, OASIS isError)

Chat text: short summary using **masked** address. Full address belongs in `structuredContent` so ChatGPT can verify a mint without dumping keys.

### OASIS HTTP to use (visitor JWT)

Prefer wrapping these on `field-guide-web4-client` (new `wallet.read` / similar), then calling from MCP. Do not copy Launchboard’s oasis-client.

- Avatar + wallets: `GET /api/avatar/get-logged-in-avatar` (already used) and/or `GET /api/wallet/avatar/{id}/wallets/false/false` (`WalletController`)
- Default wallet: `GET /api/wallet/avatar/{id}/default-wallet`
- Native balance / tokens: `GET /api/wallet/avatar/{avatarId}/wallet/{walletId}/tokens` (native-only today)
- Optional: `GET /api/wallet/avatar/{avatarId}/wallet/{walletId}/analytics` for tx **counts** if `Transactions` is populated; omit history if empty rather than fabricating
- NFTs: `GET /api/nft/load-all-nfts-for_avatar/{avatarId}` and/or `GET /api/nft/load-all-web3-nfts-for-avatar/{avatarId}` (`NftController`). Parse `OASISResult`. Match gloves by `Symbol` / `MetaData.trailPinId`.

If an endpoint 401s because the OASIS JWT expired, return the same expired-session message collect already uses.

### MCP / ChatGPT constraints

- Do not change `/mcp`, widget URIs, or OAuth client setup.
- Tool list cache: ChatGPT may need reconnect after the new tool ships. Same host and path. Do not recreate the app unless the ngrok **host** changed.
- `listChanged: true` is already on the server.
- Tests: extend `src/mcp/createServer.test.ts`. Add unit tests for the wallet mapper (fixture OASIS JSON → structuredContent). Do not print JWTs in logs or tests.

### Optional small fix in the same PR (only if it stays focused)

Stop calling stoop/park pins `minted` via the `glove-` prefix heuristic. Drive `minted` from `isStreetGlovePin` / `dropKind === "glove"` (and later from NFT `trailPinId` when Phase 1 loads chain NFTs). That makes ChatGPT’s “collected vs minted” distinction real.

---

## Phase 2 (out of scope until asked)

Conversational send must not be a silent `POST /api/wallet/transfer` from ChatGPT.

Existing agent-safe API:

- `POST /api/wallet-agent/propose` (dry-run, no custody)
- `POST /api/wallet-agent/confirm` (`Confirmed=true` then `WalletManager.SendTokenAsync`)

A later MCP tool should be two steps (propose then confirm), never one-shot send. Do not decrypt keys. Do not “switch OASIS providers” as a ChatGPT action.

---

## Acceptance (Phase 1)

1. `npm test` in `finsbury-guide` (build `clients/field-guide-web4-client` first).
2. With a live OASIS JWT, `field_guide_wallet` returns the same Solana address You desk shows (masked in prose, full in structuredContent).
3. After a successful **glove** collect, the new GLOVE / `trailPinId` appears under `nfts` or an honest OASIS error if the NFT API lags. Do not mark minted from STAR alone.
4. After Hitchhiker Stoop collect, `fieldGuide.collectedPinIds` includes `hitchhiker-stoop` and `minted` stays false unless an NFT exists.
5. Expired OASIS JWT: explicit error, no empty wallet success.
6. No private keys in the tool payload.

Do not commit OAuth ticket stores or `.env`. Commit as Max. No Cursor co-author trailer.
