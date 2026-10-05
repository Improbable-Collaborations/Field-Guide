# Field Guide: Day After Tomorrow (mindfulness course)

**Intent:** A new Field Guide, not a fork of the park circuit. One walk to nature, themed audio, a sit, a dwell clock, then a course of several sits with a story spine.

**Voice source:** Marius, [You cannot change the present moment](https://www.youtube.com/watch?v=ubbSAUaLY3o). Core claim: you cannot change what you are faced with *now*. Resistance keeps it energized. Withdraw emotional investment, turn awareness inward (meta-consciousness), use imagination to choose identity. Nietzsche: only the day after tomorrow belongs to you.

This Guide is for someone whose heart is hurting and who wants better mental models. It is **not** dating advice, therapy, or a ChatGPT breakup coach. It is a body-in-place practice: walk, sit, listen, leave.

**Related:** Finsbury circuit (`783700a0-5f6f-4861-993b-7c1ff76b3a26`), Hitchhiker Stoop check-in, `Docs/Devs/AGENT_Root_Cause_No_Fallbacks.md`, CourseHolon / LessonHolon (`holon_course_*`, `holon_lesson_*`). Trail pins already have `audioUrl`. Aether is not in this repo yet.

---

## Product name (working)

**Day After Tomorrow.** Subtitle: a Field Guide sit. Working place id `trail-day-after-tomorrow`.

Do not call it a “healing trail” or “breakup quest” in the published copy. The visitor already knows why they opened it. The Guide speaks Marius’s model: present, investment, imagination, agency.

---

## Player loop (one lesson)

1. **Start.** Visitor opens this Guide on Field Guide (phone) or ChatGPT MCP. GPS required. No desk stand-in for the sit.
2. **Go to nature.** App sends them to the nearest authored nature pin (v1: Finsbury Park sit). Later: resolve nearest park from live GPS without inventing streets.
3. **Walk.** Headphones. Themed walk audio (Aether later; placeholder `audioUrl` now). Optional side pin: a named cafe with an offer. Cafe is **not** required to complete the sit.
4. **Arrive.** Inside `radiusM`, Walk switches from Go to **Sit**. No AR Look. This is not a glove, but it **does** mint.
5. **Sit.** Guided meditation plays. App records enter time, last GPS in radius, and audio position.
6. **Complete.** When the dwell gate passes: mint this lesson’s themed SPL into the avatar Solana wallet, then STAR progress. The NFT is the key to the next lesson. Then they walk out.

Collect is `client.checkIn.handle` with a **sit mint path** (same shape as gloves: JWT → wallet → `POST /api/nft/mint-nft` → STAR). The **gate before mint** is dwell, not a single I’m here tap. Pin id = objective title = `ItemCollectedName` = NFT `MetaData.trailPinId`. `dropKind` / `questRole`: `sit` (not `glove`, not `beacon`).

---

## Story and course

One **CourseHolon**. Each session is one **LessonHolon** plus one STAR quest (or one sit objective). Course enroll is the syllabus. STAR is the walk. The **wallet NFT** is the unlock key. Do not unlock lesson N+1 from STAR or localStorage if the lesson-N NFT is missing.

Working five-lesson spine (titles can change; the model should not). Each row is a **different SPL**, not a reused token.

| # | Lesson | Sit prompt | Walk theme | NFT (working) | Unlocks |
|---|--------|------------|------------|---------------|---------|
| 1 | What is here | Stop trying to change today. Name what you are faced with. Do not argue with it. | Withdraw resistance | pin `sit-still-stone`, **Still Stone** / STONE | Lesson 2 |
| 2 | Investment | Notice where attention is still out there. Bring it back. | Attention inward | `sit-withdrawn-coin`, **Withdrawn Coin** / COIN | Lesson 3 |
| 3 | Awareness of being | Sit as the one who is aware, not as the story. | Meta-consciousness | `sit-empty-bowl`, **Empty Bowl** / BOWL | Lesson 4 |
| 4 | Choose | Feel the identity that already has the life you would pick. | Imagination as practice | `sit-chosen-seed`, **Chosen Seed** / SEED | Lesson 5 |
| 5 | Day after tomorrow | Leave the park. Today still belongs to who you were. Walk as the one who owns later. | Agency | `sit-daybreak`, **Daybreak** / DAWN | Course complete |

Lesson 1 has no prior NFT. Map, You, and ChatGPT call **one** unlock check: avatar holds an OASIS/Web3 NFT whose `MetaData.trailPinId` (or Memo) equals the previous sit pin id. If mint succeeded and STAR failed, keep the NFT, do not remint, retry STAR; the next lesson may already unlock because the key is the NFT.

Optional later: a sixth “return” lesson at the same lawn with new audio. Same coordinates, **new** pin id, **new** NFT. Do not reuse `sit-what-is-here`.

---

## NFT mint and unlock (invariant)

Same mint contract as JAB gloves. Do not add a second mint API “for mindfulness.”

```
dwell gate passes
  → ensure Solana wallet (existing ensureSolanaWallet)
  → POST /api/nft/mint-nft
       Symbol: lesson symbol (not GLOVE)
       NFTStandardType: SPL
       SendToAddressAfterMinting: avatar wallet
       MetaData.kind: sit
       MetaData.trailPinId: pin id
       MetaData.lessonId: LessonHolon id
       image: that lesson’s art
  → session.markMintedCollectible(pin.id)  (retry must not remint)
  → STAR start/progress/complete for that pin id
```

Generalize `isStreetGlovePin` / `mintCollectibleToWallet` into **collectible mint by pin kind** (glove vs sit), one function, kind-specific Symbol and image. Do not copy-paste a parallel mint.

Unlock lesson N+1 **only** if `hasMintedCollectible(sit-N)` is confirmed from **OASIS NFT load** for this avatar (chain / OASIS record), not from STAR `isCompleted` alone. STAR can show “you sat.” The NFT is what opens the next sit.

If dwell fails: no mint, no STAR, no unlock.
If mint fails: no STAR, no unlock, surface the OASIS error.
If mint succeeds, STAR fails: NFT kept, no remint, STAR retry, unlock may already be true.

Cafe pins do not mint.

---

## Architecture (one stack)

Same product as Hitchhiker’s Guide to Finsbury Park.

| Layer | Role |
|-------|------|
| GeoJSON trail | Walk LineString (optional) + Point pins: `go-nature`, `sit-*`, optional `cafe-*` |
| Place | `places.ts` entry, persona cluster so it is not mixed into Alex’s night venues by default |
| STAR | One quest per lesson (or one quest, five sit objectives). `gameSource: FieldGuide` |
| CourseHolon | Syllabus, order, enroll |
| LessonHolon | `duration` seconds, transcript/markdown, audio URL, display order |
| Walk UI | New Sit overlay (not Look camera). Play audio, dwell meter, Complete when gated |
| MCP | ChatGPT can steer GPS like the park circuit: context, map trail, sit overlay, check-in **after** dwell |
| You page | Course progress: lessons complete, which NFTs are in wallet, minutes sat (from dwell, not from “opened audio”) |

**Do not:** a second meditation app, a Unity-only path, a second mint pipeline, unlock from STAR without the NFT, or “if sit fails mark complete locally.”

Aether: pin `audioUrl` / lesson media field. When Aether exists, point those URLs at it. Do not stub a fake player that pretends Aether is live.

---

## Nearest park

**v1.** Author one sit at a real Finsbury Park lawn or bench (surveyed lat/lon, `radiusM` large enough to sit, e.g. 35–50m). The “nearest nature” copy can still say “your park” if the visitor is already in Finsbury. Do not invent a park polygon.

**v2.** From live GPS, pick the nearest feature from a **curated** London parks list (or OSM `leisure=park` with a human-reviewed allowlist). Spawn a **session** sit pin at that park’s centroid or a known entrance, still a Point with radius. Do not draw fake paths through streets. Walking directions: pin lat/lon + phone GPS, same rule as the circuit.

If GPS is missing: fail closed. No sit complete.

---

## Cafe and offers

Optional Point `dropKind: cafe` with `title`, `offerText`, `offerUrl` (or a holon id later). ChatGPT / Walk can say “coffee at X, offer Y” while they are *en route*. Checking in at the cafe is a **side** STAR objective or no STAR at all (narrative only). Completing the sit must not require the cafe.

Do not scrape discounts. Author them. If the offer expires, the pin copy is wrong: fix the pin, do not hide a second “generic cafe” path.

---

## Dwell clock (invariant)

Owner: Field Guide Walk, using phone GPS samples plus audio clock.

Proposed record (session, then STAR progress payload):

- `pinId`
- `enteredAt`, `lastInRadiusAt`
- `dwellSeconds` (only time with GPS inside radius)
- `audioSecondsPlayed` (not seek-to-end)
- `requiredSeconds` from LessonHolon duration

Complete sit → dwell gate → sit mint → STAR (`checkIn.handle` sit/glove-style, not beacon STAR-only). If they leave the radius, pause dwell and pause “counts as sitting.” If they skip audio past the threshold, do not mint.

Tests: in radius 10s with 10min lesson → no mint. In radius full duration, audio skipped → no mint. In radius full duration, audio played → NFT in wallet with that `trailPinId`, STAR objective true, next lesson unlocks. Missing NFT → next lesson stays closed even if STAR looks complete.

Do not trust ChatGPT’s street address as GPS.

---

## ChatGPT

Same connector `{origin}/mcp`. Do not change the path.

New tool only if Sit cannot reuse Look: e.g. `field_guide_sit` (widget with play + dwell) then `field_guide_check_in` when the widget reports the gate passed. Until the widget exists, ChatGPT must not mark the sit complete.

Context pack: `field_guide_context` includes a **Day After Tomorrow companion** block (model, stay-on-theme rules, open sit line, what to say if they name the hurt or ask for advice). ChatGPT must not become a breakup coach. Pins, which sit NFTs are in the wallet, next lesson lock (NFT, not STAR), cafe optional, “do not invent a park.”

---

## Phases

0. **Copy and pins.** Place, GeoJSON sit pin (real coords), quest pack JSON, persona cluster, tests like `hitchhikerStoop.test.ts`. Placeholder walk/sit audio files or silent `audioUrl` with honest UI (“audio later”).
1. **Sit overlay + dwell gate + mint + STAR.** One lesson. Prove: dwell, then a HERE (or lesson-1) SPL in the avatar wallet, then STAR. No remint on retry.
2. **CourseHolon + four more lessons.** Each sit mints a **different** themed NFT. Lesson N+1 locked until OASIS shows the lesson-N NFT. You page syllabus + wallet.
3. **Optional cafe pin** with one authored offer.
4. **Aether** swap on `audioUrl`.
5. **Nearest park v2** (allowlist), only after one Finsbury sit is proven.

Do not start 5 before 1. Same lesson as gloves: do not walk a long story until collect is true.

---

## Files to touch (when building)

- `field-guide/finsbury-guide/src/places.ts`
- `src/quests/dayAfterTomorrow.ts` (new, same pattern as `hitchhikerStoop.ts`)
- `public/trails/day-after-tomorrow.geojson`
- `public/quest-packs/day-after-tomorrow-lesson-1.json` (then 2–5)
- Walk Sit overlay (sibling of `look/lookOverlay.ts`, camera off)
- `checkIn.ts` / `drops.mintCollectibleToWallet`: sit mints like gloves, different Symbol/image/`trailPinId`; unlock reads OASIS NFTs
- `loadAvatarGuide` minted flag: sit pins count as minted only when the NFT exists, not from a `glove-` prefix heuristic
- MCP tools + context pack
- STAR publish on Railway (`gameSource` FieldGuide)
- Course/Lesson holons via existing MCP, not a new holon type unless duration/dwell cannot live on LessonHolon

---

## Open decisions (ask before coding if blocked)

- License to use Marius’s words vs original Field Guide narration in his model (need his ok for quotes / voice).
- One STAR quest with five sit objectives vs five quests under one CourseHolon.
- Minimum sit length (suggest 8–12 minutes for lesson 1).
- Whether cafe is London-authored only or later offer holon.

---

## Resume line

> Build Day After Tomorrow per `Docs/Devs/FIELD_GUIDE_MINDFULNESS_QUEST_PLAN.md`. Same Field Guide, sit dwell then themed SPL mint then STAR. Next lesson unlocks only if that NFT is in the OASIS wallet. No second mint API, no MCP path change, no nearest-park engine until lesson 1 mint is proven.
