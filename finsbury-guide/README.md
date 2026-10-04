# Hitchhiker's Guide to Finsbury Park

London Field Guide surface: MapLibre + `field-guide-web4-client`, centred on Unity's Finsbury stand-in (`51.5714, -0.0998`).

## Run

```bash
cd clients/field-guide-web4-client && npm install && npm run build
cd ../../finsbury-guide && npm install && npm run dev
```

Open http://localhost:5179

`npm run dev` also starts the Field Guide MCP. On **You**, sign in and press **Connect my AI**. That opens Claude's add-connector dialog with Field Guide already filled in. Confirm Add. ChatGPT can use the same personal URL (copied to the clipboard). Claude and ChatGPT need a public HTTPS origin, so tunnel localhost if you are on 5179.

Tools: `field_guide_context` and `field_guide_progress` are read-only. They see authored guides, this avatar’s STAR progress, and what the open tab is showing. They cannot edit the published Field Guide or drive the UI. The visitor updates their own progress in Walk / Look. Keep the Field Guide tab open after Connect so the chat can see live presence.

On a phone the same app is the Field Guide: map on top, list underneath, 44px controls, You and Walk as full screens. Add to Home Screen if you want it like an app. `?deskWalk=1` uses the next pin as you only if GPS is missing.

## What it includes

- Seeded park / transit / culture / sport venues around Finsbury Park
- **JAB SW1 Street Gloves** quest: six street pins around the Victoria club, shown only after you open that trail (not on boot or when wearing Alex). Check-in mints an SPL glove into the avatar Solana wallet, then STAR progress (`8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22`). AR Look mode uses the same mint path.
- **Live nearby** STAR GeoNFTs within 5 km
- **Trail packs** mirrored from Unity StreamingAssets (Killer In The Code, Highgate East, Bunhill, Bow Street, …)
- Auth + check-in via Field Guide Web4 Client
- **Personal AI:** You page **Claude** / **ChatGPT** shares a read-only pack of the guides and this avatar’s progress. Keep the tab open.

## Note on trail geometry

Several London quest GeoJSON files are still **desk stand-ins** (clustered ~51.52, -0.097), not park-accurate. Park venues use real Finsbury GPS. Replacing stand-in coords with true Highgate / Bunhill / Bow Street points is a follow-up content pass.
