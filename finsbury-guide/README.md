# Hitchhiker's Guide to Finsbury Park

London Field Guide surface: MapLibre + `field-guide-web4-client`, centred on Unity's Finsbury stand-in (`51.5714, -0.0998`).

## Run

```bash
cd field-guide/finsbury-guide
npm install
npm run dev
```

Open http://localhost:5179

`npm run dev` also starts the Field Guide MCP. On **You**, press **Claude** or **ChatGPT**. The shared URL is `{origin}/mcp`. ChatGPT does not let you edit a connector URL, and it caches tools per URL, so we never change that path. Older aliases (`/mcp/map-layers`, `/mcp/map-ui`) still serve the same server. ChatGPT and Claude discover OAuth at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`. Each visitor signs in with their OASIS avatar on the Field Guide authorize page. Create the ChatGPT app once (not auth none). Recreate it only if the public **host** changes (free ngrok URLs do that). Set `FIELD_GUIDE_PUBLIC_ORIGIN` when the issuer must be a stable https host.

Tools: `field_guide_context`, `field_guide_progress`, `field_guide_wallet`, `field_guide_map`, `field_guide_render_map`, `field_guide_look`, `field_guide_sit`, `field_guide_check_in`, `field_guide_open_look`, and `field_guide_drop_photo`. `field_guide_map` requires `layer`: `ra`, `gig`, `nearby`, `trail`, `place`, or `personal`. Optional `placeId` limits only the published trail/place features. Map data tools return GeoJSON as `structuredContent`. `field_guide_render_map` is the MCP App UI (`ui://field-guide/map/v5.html`, `text/html;profile=mcp-app`) that ChatGPT draws inline. Trail GeoJSON may include LineString walks.

On a phone the same app is the Field Guide: map on top, list underneath, 44px controls, You and Walk as full screens. Add to Home Screen if you want it like an app. `?deskWalk=1` uses the next pin as you only if GPS is missing.

## What it includes

- Seeded park / transit / culture / sport venues around Finsbury Park
- **Day After Tomorrow:** five sits on a Finsbury Park lawn. Placeholder audio. Completing a sit mints Still Stone, Withdrawn Coin, Empty Bowl, Chosen Seed, or Daybreak into the OASIS Solana wallet. That NFT unlocks the next sit (STAR `9a4c2e81-6f0b-4d3a-9c17-2e8b5a1d4c70`). `field_guide_context` includes the sit companion voice so ChatGPT stays on the model (not a breakup coach).
- **Hitchhiker Stoop:** one pavement beacon outside Hitchhiker House (`hitchhiker-stoop`, STAR `e86e2c7d-7cdd-4542-b82d-7d1bd27b46df`). Smoke-test GPS check-in before the park walk.
- **Finsbury Park Circuit** quest: five beacons inside the park. ChatGPT on a phone can guide and check in over MCP: pass GPS into `field_guide_context`, open `field_guide_look`, then `field_guide_check_in` when you are inside the radius (STAR `783700a0-5f6f-4861-993b-7c1ff76b3a26`).
- **JAB SW1 Street Gloves** quest: six street pins around the Victoria club, shown only after you open that trail (not on boot or when wearing Alex). Check-in mints an SPL glove into the avatar Solana wallet, then STAR progress (`8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22`). AR Look mode (camera collect, same mint path): [build plan](../docs/FIELD_GUIDE_AR_GLOVE_COLLECT_BUILD_PLAN.md).
- **Live nearby** STAR GeoNFTs within 5 km
- **Trail packs** mirrored from Unity StreamingAssets (Killer In The Code, Highgate East, Bunhill, Bow Street, …)
- Auth + check-in via Field Guide Web4 Client
- **Personal AI:** one OAuth MCP at `/mcp`. You page **Claude** / **ChatGPT** opens that connector. Keep the Field Guide tab open for live presence.

## Note on trail geometry

Several London quest GeoJSON files are still **desk stand-ins** (clustered ~51.52, -0.097), not park-accurate. Park venues use real Finsbury GPS. Replacing stand-in coords with true Highgate / Bunhill / Bow Street points is a follow-up content pass.
