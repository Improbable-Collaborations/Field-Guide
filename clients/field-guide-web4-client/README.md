# Field Guide Web4 Client

Browser TypeScript client for the Field Guide / AR World shared backend. Mirrors the Unity HTTP clients under `_inspect_ARWorld` (ONODE WEB4 + STAR WEB5).

## Install

From this repo (path package):

```bash
cd clients/field-guide-web4-client
npm install
npm run build
```

In an app:

```bash
npm install ../clients/field-guide-web4-client
```

## Quick start

```ts
import { createFieldGuideWeb4Client } from "field-guide-web4-client"

const client = createFieldGuideWeb4Client({
  // defaults match Unity OasisApiConfig Railway hosts
  configuredQuestId: "a06c5f9b-1c0e-4ed9-b080-ccbe6602b14d", // Murder Stones
  // Serve quest-packs/ + trails/ from field-guide-web dist root
  contentBaseUrl: "",
})

await client.auth.authenticate({ email: "you@example.com", password: "…" })

// Local packs + catalog (Unity StreamingAssets parity)
const catalog = await client.content.loadCatalog()
const localQuests = await client.content.loadAllPacks()
const experience = await client.content.loadQuestExperience(localQuests[0].id)
// experience.pins → draw on MapLibre; experience.spawn → map focus

const nearby = await client.geo.nearby({
  lat: experience.spawn?.lat ?? 51.56,
  lon: experience.spawn?.lon ?? -0.1,
  radiusKm: 2,
})

const remote = await client.quests.list()
const worldscape = await client.content.mergeWithRemote(remote)
await client.checkIn.handle(experience.pins[0], { questId: experience.quest?.id })
```

## Surface (Unity parity)

| Module | Unity source | Methods |
|--------|--------------|---------|
| `session` | `OasisSession` | JWT + avatar + local check-ins |
| `auth` | `Authentication` / Google | `authenticate`, `authenticateGoogle` |
| `quests` | `StarQuestClient` | `list`, `get`, `start`, `progress`, `complete`, pin helpers |
| `geo` | `StarNearbyClient` / `StarGeoNftDropClient` | `nearby`, `placePin`, `postStreetEvent` |
| `drops` | `Web4GeoNftDropClient` | `dropAt` (mint-and-place then place-pin); `mintCollectibleToWallet` (street glove SPL into avatar wallet, no new geo pin) |
| `checkIn` | `QuestCheckInBridge` | `handle(pin)`: gloves mint then STAR progress; shared drops street-event; other pins start/progress/complete |
| `content` | `QuestPackLoader` / `TrailGeoJsonLoader` | `loadAllPacks`, `loadCatalog`, `loadTrailFile`, `loadQuestExperience`, `mergeWithRemote` |

Invariant: STAR objective **title** equals trail **pin id**. Progress sends `ItemCollectedName` as that id.

## Config defaults

- `oasisBaseUrl`: Railway ONODE (same as Unity `OasisApiConfig`)
- `starBaseUrl`: Railway STAR
- `source`: `field-guide-web` (Unity uses `field-guide-unity`)
- `contentBaseUrl`: root that serves `quest-packs/` and `trails/` (field-guide-web dist)
- `solanaCluster`: `devnet`

Override hosts for local ONODE/STAR when needed.

## Not in v0.1

- TrustGraph POI witness / nearby (phase 2)
- Nuva share-price / APR helpers (phase 2)
- Quest completion NFT mint reward (Unity `QuestCompletionReward`)
- PlaceKits / City Dressing / AR (Unity-only)

## License

Apache-2.0 (same as the Web4 repo).
