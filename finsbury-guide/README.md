# Hitchhiker's Guide to Finsbury Park

London Field Guide surface: MapLibre + `field-guide-web4-client`, centred on Unity's Finsbury stand-in (`51.5714, -0.0998`).

## Run

```bash
cd field-guide/finsbury-guide
npm install
npm run dev
```

Open http://localhost:5179

On a phone (HTTPS or localhost): **Walk** asks for GPS, drops a YOU marker, and locks the street camera to your live position (heading when the phone provides it). Nearby GeoNFTs also query from that fix. `?deskWalk=1` uses the next pin as you only if GPS is missing.

## What it includes

- Seeded park / transit / culture / sport venues around Finsbury Park
- **JAB SW1 Street Gloves** quest: six street pins around the Victoria club, shown only after you open that trail (not on boot or when wearing Alex). Check-in mints an SPL glove into the avatar Solana wallet, then STAR progress (`8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22`). AR Look mode (camera collect, same mint path): [build plan](../../Docs/Devs/FIELD_GUIDE_AR_GLOVE_COLLECT_BUILD_PLAN.md).
- **Live nearby** STAR GeoNFTs within 5 km
- **Trail packs** mirrored from Unity StreamingAssets (Killer In The Code, Highgate East, Bunhill, Bow Street, …)
- Auth + check-in via Field Guide Web4 Client

## Note on trail geometry

Several London quest GeoJSON files are still **desk stand-ins** (clustered ~51.52, -0.097), not park-accurate. Park venues use real Finsbury GPS. Replacing stand-in coords with true Highgate / Bunhill / Bow Street points is a follow-up content pass.
