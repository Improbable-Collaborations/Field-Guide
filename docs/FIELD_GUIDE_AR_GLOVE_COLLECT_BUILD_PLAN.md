# Field Guide: AR street-glove collect (build plan)

**Date:** 2026-10-03  
**Demo quest:** JAB SW1 Street Gloves (`8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22`)  
**Clients:** Finsbury Guide (`field-guide/finsbury-guide`) + `field-guide-web4-client`  
**Related:** Unity Field Guide in `_inspect_ARWorld` (World Moments + `FieldGuideDropCollect`)

---

## 1. Same app or a new app?

**Same Field Guide product. New Look surface, not a new app.**

The hunt is already a Field Guide adventure: map, persona cluster, JWT, OASIS wallet, STAR objectives. AR is how you *see* the mitt. Collect is still `checkIn.handle`. A second app would split sign-in, wallet, quest ticks, and the map. That is two ledgers for one glove.

| Surface | Role |
|---------|------|
| **Finsbury Guide (browser)** | Ship Look + collect here first. HTTPS, same session, same mint. |
| **Unity Field Guide** | Keep for trails, bag, World Moments. Later it can Look at the same pin ids using the same OASIS/STAR contract. Do not fork mint logic. |
| **New “AR collector” app** | Do not. Presentation-only AR with a copy of mint is a workaround. |

Unity World Moments (`WorldMomentArHost` + AR Foundation) is the Avebury-scale enter. It is the wrong first vehicle for six street gloves. Unity `FieldGuideDropCollect` is the ceremony to copy (object lifts, then check-in), not the XR stack to port.

---

## 2. Invariant (one collect path)

```
STAR objective.title
  = GeoJSON pin id
  = ItemCollectedName
  = NFT MetaData.trailPinId
  = Look-mode target id
```

**Collect always means:** JWT → OASIS Solana wallet → `POST /api/nft/mint-nft` (`Symbol: GLOVE`) → STAR start/progress (/complete when all six).  

Look mode must call `client.checkIn.handle(pin, { questId })`. It must not mint-and-place, post street-event, or mark collected locally if mint failed.

If mint succeeds and STAR fails: keep the NFT, surface the STAR error, retry must not remint (already encoded in `session.hasMintedCollectible`).

---

## 2b. Desk view vs walk view (same app)

The Finsbury Guide today is a **desk catalog**: 320px encyclopedia, layer toggles (RA, Skiddle, TfL), 3D star, 0.58rem type, sheet that assumes a mouse. Narrow screens only stack that catalog on top of a short map. That is not a walk.

Unity Field Guide already has the walk grammar: `ActiveQuestHud` (one next action: GO TO / WITNESS) plus `QuestAudioGuide` (headphones, no wiki popup). Port that grammar to the browser. Do not ship a second app.

| Mode | What you see | Hands |
|------|----------------|-------|
| **Desk** (wide screen, or until GPS) | Current catalog + star + feeds | Browse, persona, author |
| **Walk** (GPS on + active quest, or explicit Walk) | Map fills the phone. One strip: next pin, meters, Look / Collect. Audio optional. | Thumb, glance |

Walk hides: persona encyclopedia, filter row, RA embed, live-feed checkboxes, 3D star (keep a 1-tap graph if needed). Walk keeps: follow-user map, next objective, distance, Look, Collect, spoken next-pin.

Entry: **Start walk** when a trail is active, or auto when geolocation is granted and an unfinished quest is selected. Exit: **Desk** on the strip.

Look (AR overlay) is a **state inside Walk**, not a third product.

---

## 3. Player loop

1. Map (or Alex JAB cluster) shows the six glove pins.
2. Inside `radiusM`, **Look** opens the camera.
3. Glove sits in the view (distance scale; heading offset in phase B).
4. **Collect glove** runs the existing OASIS + STAR path.
5. Marker greys on the map. Wallet holds the SPL. STAR ticks that pin id.

Desk / no GPS: Look is blocked unless an explicit **desk stand-in** flag is on (Editor-style, same idea as Unity Finsbury stand-in). Default is fail closed: no GPS, no collect.

---

## 4. Phases

### Phase 0: Token path is true (block Look until this holds)

Without this, AR is theatre.

- [ ] Avatar signed in on Finsbury Guide (username/password body that ONODE accepts).
- [ ] `resolveReceiveWallet` returns a Solana address (create if missing). No Phantom required.
- [ ] `POST /api/nft/mint-nft` returns mint hash or token address; glove in OASIS wallet.
- [ ] STAR quest holon published with six objectives; each `Title` and `NeedToCollectItems["FieldGuide"]` is the pin id.
- [ ] Map **Collect glove** already succeeds once before Look ships.

Owner: ONODE Railway + STAR Railway + local pack (already authored).

### Phase A0: Walk chrome (phone, before Look)

The map must become a companion, not a catalog.

- [x] `body.mode-walk`: map full viewport, follow GPS, hide `#panel` encyclopedia / `#star-glyph` / nav toggles.
- [x] Bottom strip: quest name, next pin title, meters, **Look**, **Collect**, **Desk**.
- [x] Optional TTS of `narrationText` + next-pin `directionHint` (Unity `QuestAudioGuide`).
- [x] Sheet is full-width, large tap targets (min ~44px), not a 0.58rem desk card.
- [x] Safe-area padding; wake lock while Walk is on.

### Phase A: Camera Look (easiest demo, inside Walk)

In `field-guide/finsbury-guide` only. No new package if possible.

- [x] Glove sheet: **Look** next to **Collect glove**.
- [x] Full-screen camera (`getUserMedia`, rear, HTTPS). iOS needs a user gesture.
- [x] Overlay `boxing-glove.svg` (or a small GLB later). Scale by Haversine distance to pin.
- [x] Collect in Look calls `checkIn.handle` with the **same pin object** as the map.
- [x] Status line: mint in progress / in wallet / STAR error.
- [x] Permission denied and HTTP (non-HTTPS) fail visibly.

Out of scope for A: compass, plane hit-test, WebXR, Unity.

### Phase B: GPS + heading (street-honest)

- [x] Device orientation / compass (iOS needs `DeviceOrientationEvent` permission).
- [x] Place the mitt in screen space from bearing to pin (port of `WorldMomentPoseGpsCompass`, JS).
- [x] Collect enabled only inside `radiusM` (except documented desk stand-in).
- [x] Tests: bearing math, radius gate, pin-id join (extend `jabSw1Gloves.test.ts`).

### Phase C: Unity parity (optional, later)

- [ ] Same pin ids in `_inspect_ARWorld` trail pack.
- [ ] Look-at-glove: camera overlay or a tiny World Moment kit that is **one mitt**, then `QuestCheckInBridge` with the gloves quest id.
- [ ] Mint through the same ONODE contract Unity already uses for wallet NFTs, not a second “AR mint.”

Skip C until A+B are playable on a phone at Victoria.

---

## 5. Files to touch (A/B)

| File | Change |
|------|--------|
| `field-guide/finsbury-guide/src/main.ts` | Look overlay, wire Collect |
| `field-guide/finsbury-guide/src/styles.css` | Full-screen Look chrome |
| `field-guide/finsbury-guide/src/look/*` (new) | Camera, distance scale, later heading |
| `field-guide/finsbury-guide/src/quests/jabSw1Gloves.ts` | Unchanged ids |
| `Web4/clients/field-guide-web4-client/src/checkIn.ts` | No fork; maybe `source: field-guide-web-look` on progress if STAR wants GameSource |
| `Web4/clients/field-guide-web4-client/src/drops.ts` | HTTPS `gloveNftImageUrl` (placeholder is not a real mint image) |

Do not add a second mint function for AR.

---

## 6. Explicit non-goals

- New native app or PWA whose only job is AR collect
- 8th Wall / Niantic VPS / WebXR geospatial as v1 (Android-only, extra vendor)
- Dual collect: “AR local success then maybe mint”
- Feeding JabMon from glove collect (gym check-in is a different quest)

---

## 7. Verify

1. Sign in on HTTPS phone (or `localhost` on desktop with fake GPS later).
2. Open Street gloves trail. Look at `glove-victoria-door`.
3. Collect: status shows mint, then progress. Map marker collected. Wallet shows `GLOVE`. STAR objective for that pin id complete.
4. Collect again: no second mint.
5. Look outside `radiusM`: collect refused (phase B).
6. Airplane mode after camera open: mint error, pin not marked collected.

---

## 8. Why this order

Phase 0 is the product. Phase A is one afternoon of UI on the app people already open. Phase B is the “it’s on the pavement” feel. Unity is a second *client* of the same tokens, not a second game.
