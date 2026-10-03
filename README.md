# Field Guide

Hitchhikers Field Guide web maps (Finsbury Park, Playa) and the OASIS holonic galaxy / pre-check pages. Published for [Improbable Collaborations](https://github.com/Improbable-Collaborations).

The Finsbury app (`finsbury-guide/`) is Walk + GPS follow + Look (camera overlay) plus the JAB SW1 street-gloves quest. Glove pins appear only after you open that trail.

The Web4 client used by both city guides lives in `clients/field-guide-web4-client/` (ONODE mint + STAR quest progress).

## Run Finsbury

```bash
cd clients/field-guide-web4-client && npm install && npm run build
cd ../../finsbury-guide && npm install && npm run dev
```

Open http://localhost:5179

## Pages

| Path | Description |
|------|-------------|
| `/` or `/galaxy` | Celestial galaxy map (legacy name in-app) |
| `/check` | Holonic Pre-Check — scan a GitHub repo, Web3 protocol, or local project for celestial classification |
| `/import` | Import Portal |
| `/playa-map.html` | Legacy Hitchhiker's Guide to Playa del Carmen (static) |
| `playa-guide/` | Playa Guide Vite app + Field Guide Web4 Client (`npm run dev` → :5178) |
| `finsbury-guide/` | Hitchhiker's Guide to Finsbury Park (London) + Web4 Client (`npm run dev` → :5179) |

## Celestial Tiers

Projects are classified based on size and activity metrics:

| Tier | Criteria |
|------|----------|
| 🌑 Moon | < 1k LOC / small token |
| 🌍 Planet | 1k–10k LOC / small cap |
| ⭐ Star | 10k–100k LOC / mid cap |
| 🌟 SuperStar | 100k–500k LOC / large cap |
| 💫 GrandSuperStar | 500k+ LOC / mega cap |

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Improbable-Collaborations/Field-Guide)

```bash
# One-shot deploy via CLI
npx vercel --prod
```

## Backend

The GitHub and Web3 pre-checks run entirely in-browser via public APIs (GitHub, DefiLlama, CoinGecko). No backend required for these features.

The **Local Clone** scan tab requires the OASIS WebAPI running locally:
```bash
cd "STAR ODK/NextGenSoftware.OASIS.STAR.WebAPI"
dotnet run --urls "http://localhost:50564"
```

To connect a deployed OASIS API to the galaxy map, set `window.__OASIS_API__` before the module loads:
```html
<script>window.__OASIS_API__ = 'https://your-api.railway.app';</script>
```

## Stack

- **Three.js** — 3D galaxy rendering via ES module import map
- **Vanilla JS** — no build step, deploy as static files
- **GitHub API** — repo stats for pre-check
- **DefiLlama API** — DeFi TVL and protocol data
- **CoinGecko API** — token market cap and community data
- **MetaMask** — Web3 ownership verification

## Part of OASIS

[OASIS](https://github.com/NextGenSoftwareUK/Our-World-OASIS-API-HoloNET-HoloUnity-And-HoloUnity-For-Unity) · Open Architecture for Sovereign Interdimensional Systems
