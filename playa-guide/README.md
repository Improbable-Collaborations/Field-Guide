# Hitchhiker's Guide to Playa del Carmen (Web4)

Vite + MapLibre city guide with **Field Guide Web4 Client** (`auth`, `geo.nearby`, `checkIn`) on top of the existing calibrated venue markers from `playa-map.html`.

## Run

```bash
cd field-guide/playa-guide
npm install
npm run dev
```

Open http://localhost:5178

```bash
npm run build
npm run preview
```

## What it does

- Renders hotels / Pulmón Verde / The Union from `src/places.ts` (extracted from `../playa-map.html`)
- **Live nearby**: `GET STAR /api/GeoNFTs/nearby` around PDC via `field-guide-web4-client`
- **Sign in**: ONODE avatar auth; check-in on live pins when JWT present

## Relation to legacy page

| Surface | URL / path |
|---------|------------|
| Legacy static | https://hh-pdc-wsyc.vercel.app/playa-map.html · `../playa-map.html` |
| This app | local Vite · `playa-guide/` |

Depends on `../../../Web4/clients/field-guide-web4-client`.
