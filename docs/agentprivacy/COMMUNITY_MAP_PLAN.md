# Plan: an in-person community map

The goal is a map a community uses in the same physical place. People meet
face to face, form a relationship both consent to, and from then on each sees
the places the other chose to share. No feed, no score, no strangers.

Sources for every term are in [REFERENCE_MAP.md](REFERENCE_MAP.md). The model
is the field guide counter-spec; the credentials are OpenVTC's.

## What lives here

The map and the guide live in this repo. Relationships, membership and
credentials are OpenVTC's and are used as OpenVTC defines them. What makes
this implementation its own is place: it is OpenVTC enhanced by location.

| OpenVTC gives | This repo adds |
|---|---|
| A relationship two people both sign | The Meet happens standing together, checked for co-location, and remembers roughly where |
| A witnessed statement about a relationship | Witnessing a place: a discovery tied to a pin on the ground |
| A community with members | A map layer only its members see, in the streets the community shares |
| A pairwise reference to a peer | Pins on your map that came from that peer, at the audience they granted |

Location is the enhancement and also the risk. A place trail identifies a
person faster than a name does, so every rule OpenVTC has about identifiers
applies here to coordinates as well: coarse by default, exact only by grant,
absent when private, and never in a directory.

## 1. The three layers

| Layer | Holds | Rule |
|---|---|---|
| **Knowledge** | What one person witnessed: places, notes, taste | Stays with its owner in full |
| **Promise** | What a given viewer may see of it | A closed allow-list per audience: `public`, `link`, `acquaintance`, or `private` (absent) |
| **Trust** | Whose Knowledge a person may ask for at all | One hop, formed by a Meet both people consent to |

The overlay a person sees is:

```text
for each peer I have met:
    their discoveries in radius, each projected at the audience they granted me
then nearest first, capped at 12
```

An empty overlay is the correct answer for someone who has met nobody.

Two rulings carry most of the weight. Both come from the counter-spec.

**Audience is granted, not computed.** A met peer gets `link`. Nothing gets
anyone `acquaintance` except the owner handing it to them. Graph distance
never raises an audience: two hops is not half of `link`, it is nothing. Once
two-hop peers leak in at a reduced tier there is a score in all but name, and
everyone's incentive becomes collecting edges.

**The peer reference is pairwise.** A projection carries the owner's
reference toward this one viewer. Two people who have both met the same third
person hold two references to them that cannot be joined, so they cannot pool
what they were shown to rebuild a trail neither was given.

## 2. Where the repo stands

| Piece | State | Code |
|---|---|---|
| Promise projection for a worn graph | Built and tested. The mapping of taste fields to tiers is this repo's reading; the counter-spec only specifies place fields | `finsbury-guide/src/trustGraph/promise.ts` |
| Demo people | Labelled as demo; worn at `link`; their friends' whereabouts never project | `personas.ts`, `main.ts` |
| Chat connector pack | Closed allow-list; no avatar id, no email, wallet masked | `profile/contextPack.ts`, `mcp/createServer.ts` |
| City Key reading | Built, passes the seven conformance cases | `trustGraph/cityKey.ts` |
| Client peer fields | No longer filled from a drop's creator. Reserved for a met peer | `clients/field-guide-web4-client/src/types.ts`, `geo.ts` |
| Witness a place, Meet a person, the overlay query | Not in this repo. The backend routes they need are OASIS-side | none |
| OpenVTC | Nothing wired | none |

The projection tiers in use today:

| Audience | Place record (counter-spec) | Demo cluster (this repo) |
|---|---|---|
| `public` | pin id, title, kind, marker style, location rounded to about 100 m | id, label, colour, slot, place ids |
| `link` | adds wiki slug, rite, trail, time witnessed, exact location | adds feeds, genres, liked venues |
| `acquaintance` | adds the note | adds artists |
| `private` | the pin is absent, not blank | the cluster is absent |
| never, at any audience | quest id, quest pin role, source, client, avatar id, parent, record id, witness count, the disclosure policy | friends and their venues, quest ids, the disclosure policy |

## 3. Phases

Each phase is done when its acceptance line passes. Do them in order; each
one is useful alone. Property names (M1, P2 and so on) are the counter-spec's
and each is an executable check in its `runtimes/` folder.

### Phase 1. Witness

A visitor in range of a pin performs the Witness rite and the discovery is
written to their own Knowledge.

The request, to `POST /api/trustgraph/poi/witness`:

```json
{
  "poiId": "sailors-stone",
  "title": "Sailors' Stone",
  "placeKind": "Memorial",
  "lat": 51.5194,
  "lon": -0.1269,
  "source": "quest",
  "rite": "desk-witness",
  "disclosure": { "maxAudience": "link", "deny": ["note"] }
}
```

`source` is one of `city-discover`, `quest`, `seed`, `demo`, `partner`.
`rite` is one of `desk-witness`, `camera-fetch`, `seal`, `banish`. Times are
ISO-8601, never epoch.

Work in this repo:

- `clients/field-guide-web4-client/src/`: add a `trust` module with
  `witnessPlace(pin, opts)`. It sends the pin id the client already spawned.
  It never mints a second id for a pin.
- `finsbury-guide/src/main.ts`: call it after a successful check-in, without
  waiting on it. No session token means a local stamp only.
- The Walk and Look check-in sheet gains one control: who may see this
  place, defaulting to `link`, with `private` one tap away.

Accept:

| Property | Says |
|---|---|
| K1 | Witness is idempotent on person and pin |
| K2 | A missing required field is refused |
| K3 | An unknown rite is refused. Walking past a pin witnesses nothing |
| K4 | Renaming a pin id migrates existing records and mints no second id |
| K5 | A reinstall restores every field the client stamped |
| P9 | A quest pin caps at `link` even for an acquaintance, because a quest pin says what the person was doing |

### Phase 2. Meet

Two people standing together form an edge. One phone shows a QR, the other
scans it, the first confirms. The route is `POST /api/trustgraph/witness`,
which is about a person. It is deliberately a different route from
`/poi/witness`, which is about a place.

```text
A opens Meet          step=offer     QR on A's screen, valid 120 seconds
B scans the QR        step=accept    B has consented
A confirms on device  step=confirm   A has consented, and the edge exists
```

The scan alone is an encounter, not an edge.

```json
{ "step": "offer", "nonce": "<128-bit random>", "lat": 51.5344, "lon": -0.1016,
  "presentAs": "Mitch" }
```

```json
{ "step": "accept", "offer": { "a": "…", "nonce": "…", "lat": 51.5344,
  "lon": -0.1016, "issuedUtc": "…", "expiresUtc": "…", "tag": "…" },
  "nonce": "<B's nonce>", "lat": 51.5345, "lon": -0.1017,
  "consent": true, "presentAs": "Maya" }
```

The accepter derives a shared value from both nonces and the offer tag, makes
its own pairwise reference, and asserts a link commitment. The accepter
cannot create the edge. On `confirm` the offerer recomputes everything from
the public parts and passes eight gates, in this order:

| # | Gate | Rejection code | Property |
|---|---|---|---|
| 1 | The confirmer opened this meet | `offer-not-mine` | |
| 2 | No edge to yourself | `self-edge-forbidden` | M3 |
| 3 | Both consented | `unilateral-no-mutual-consent` | M1 |
| 4 | The offer has not expired | `meet-offer-expired` | M4 |
| 5 | The nonce is used once | `meet-offer-replayed` | M5 |
| 6 | Within 50 m of each other | `meet-not-colocated` | M6 |
| 7 | The commitment is recomputed, not trusted | `link-commitment-forged` | M7 |
| 8 | One link per pair | `duplicate-link` | M8 |

Gate 7 is the structural one. The confirming side never trusts the scanning
side's claimed link; it recomputes it. A tampered client cannot talk its
counterpart into an edge.

The stored edge:

```json
{
  "kind": "TrustLink",
  "a": "<person A>", "b": "<person B>",
  "rdidA": "<A's pairwise reference toward B>",
  "rdidB": "<B's pairwise reference toward A>",
  "link": "<recomputed commitment>",
  "presentA": "Mitch", "presentB": "Maya",
  "formedUtc": "2026-08-15T21:20:10Z",
  "placeHint": { "lat": 51.53, "lon": -0.10 }
}
```

No score, no weight, no direction (M2b). The place hint is rounded to about
1 km: a meet has a place, but not a doorway. `presentA` and `presentB` are
the names each side chose for the other at meet time. They live on the edge
and never on a profile.

Work in this repo:

- Client: `trust.meetOffer`, `trust.meetAccept`, `trust.meetConfirm`, each
  generating its own nonce and sending the device's position.
- Finsbury: a Meet screen on the You page with a QR, a scanner, a name field
  defaulting to the last name used, and a confirm tap on the offering phone.
- Rename `TrailPin.peerAvatarId` to `peerRef`. Both it and `peerDisplayName`
  are read from the edge.

Things that must not create an edge (each is a property or a ruling):

- Finishing the same quest. It may prompt a Meet ("you both finished Murder
  Stones, say hello?"). It is never one (M10).
- Standing near the same pin.
- Redeeming something at a venue's till. That is a receipt, not an edge. A
  venue serves hundreds of people; a symmetric edge would put every
  visitor's trail in the venue's overlay (S1).
- Similarity of taste. The demo data has a "similar" person in one cluster;
  that field is never projected and must not become a suggestion feature.

Accept: M1 to M10 and D1 to D4.

| Property | Says |
|---|---|
| M9 | Pairwise references are fresh per counterparty |
| D1 | A name is chosen per edge, not per profile |
| D2 | No identifier in a projection is shared between two viewers |
| D3 | The profile display name never reaches either viewer |
| D4 | The raw avatar id never reaches either viewer |

Read D2 first: it takes two viewers' projections of the same pin and asserts
no identifier field is equal between them.

### Phase 3. Overlay

`GET /api/trustgraph/poi/nearby?lat=…&lon=…&radiusM=…` returns `self` and
`fromGraph`.

Work in this repo:

- Client: `trust.nearby(args)` returning pins with `trustOrigin`,
  `trustAudience`, `peerRef`, `peerDisplayName` and `freshness` filled.
- Finsbury: a "From people you've met" layer. Peer pins carry a ring whose
  opacity is the freshness value.
- Remove Alex and Margaret from the default view once a real edge can exist.
  A fixture that outlives its stand-in becomes something the product says
  that is not true.

Rules, each with its property:

| Property | Says |
|---|---|
| N1 | Nobody met yet: `fromGraph` is empty, and that is correct |
| N2 | After a real Meet the peer's pin appears, marked as coming from trust |
| N3 | Trust never pulls a far pin into a near viewport |
| N4 | The cap is 12 |
| N5 | Nearest first |
| N6 | A person keeps their own note; the peer projection does not carry it |
| N7 | A two-hop peer contributes nothing to the map |
| N8 | A pin its owner marked private stays off a met peer's map |
| P1 | A `link` projection carries neither quest id nor note |
| P2 | A junk field bolted onto a record never surfaces at any audience |
| P3 | `public` gets coarse location and loses wiki slug, rite and note |
| P4 | A per-record private ceiling hides one pin from everyone |
| P5 | Audience is granted, not computed |
| P6 | `acquaintance` needs an explicit grant by the owner |
| P7 | The peer reference is pairwise; two viewers cannot join it |
| P8 | No never-projected field appears at any audience |
| E1 | Freshness is 1 at zero age and halves every 90 days |
| E2 | There is no cliff at 90 days; it is a rate |
| E3 | A two-year-old peer pin falls below the horizon |
| E4 | A person's own trail never fades |
| E5 | A fading pin still ships, carrying its freshness so the client can fade it |

Accept: P1 to P9, N1 to N8, E1 to E5.

### Phase 4. OpenVTC underneath

Up to here the edge is bound to an OASIS avatar. This phase replaces it with
OpenVTC's own objects. The two flows already have the same shape:

| Meet rite | OpenVTC relationship handshake |
|---|---|
| `offer` | Requestor sends a relationship request and makes an R-DID |
| `accept` | Respondent accepts and makes an R-DID |
| `confirm` | Requestor finalises; status becomes Established |
| `rdidA`, `rdidB` | The two R-DIDs, each a fresh `did:peer` used with that one contact |
| `presentA`, `presentB` | The alias each side sets for the other |
| The edge | Two relationship credentials, one in each direction |

In the order the alignment note gives:

1. **The pairwise reference becomes an R-DID.** OpenVTC's default is a fresh
   identifier per relationship, and once a relationship holds one there is
   no fallback to the published persona identifier.
2. **Co-location becomes a witnessed statement.** A statement credential
   under the predicate `https://registry.trustoverip.org/dtg/vsc/witnessed/1`
   that names the relationship credential by digest. A community's VTC
   marks each one `bound`, `subjectMismatch`, `unresolved`, `absent` or
   `malformed`, and by default accepts only `bound`. The place hint, rounded
   as in phase 2, is the location enhancement: it is this project's field
   and goes in the statement's claim only if the community's accept list
   allows it.
3. **The peer-visible name becomes a persona credential.**
4. **The Meet carries a thread id** from the first message.

An edge is complete only when a relationship credential is in force in both
directions. One direction alone is a half-edge: one person's claim the other
has not answered. Expired or withdrawn halves do not complete an edge.

A relationship credential issued under a pairwise identifier must declare
`issuerScope: "pairwise"`, and a VTC refuses it if that identifier already
has an edge to anyone else. That refusal is the pairwise property enforced
by the community rather than by this app.

For the room itself OpenVTC has two pieces to reuse rather than reinvent:

- **The vetting desk**: a multi-use ticket shown as a QR with a short
  expiry. People in the room scan it one after another.
- **The spoken match code**: eight characters, such as `7F4K-2QX9`, derived
  from the challenge id with no letters that can be misheard. Both people
  say it to each other. It confirms they are in the same exchange. It is a
  pairing code, not a password, and nothing checks it server-side.

Check each credential type against OpenVTC's current credentials document
before writing code. The alignment note predates a rename, and retired types
are refused on arrival with no alias.

### Phase 5. The community

The map belongs to a community rather than to whoever opens the page.

- The community runs a VTC on top of a VTA. A member holds its membership
  credential, which expires (30 days by default) and is renewed.
- The community layer of the map shows to members only. Membership is
  checked by verifying the credential, not by a list in this repo.
- A person's AI companion is enrolled under their own VTA as a service of
  kind `ai-agent`, with a least-privilege capability set and the person's
  passkey required for sensitive actions. It gets the same closed pack the
  connector sends today.
- Any directory lists a region, country or continent, and never a city or
  coordinates. OpenVTC's vetter directory has that rule because a public
  map of key-signers' names and coordinates was a privacy failure; a
  community map must not rebuild that map by accident.
- The connections graph of a VTC is readable by its admins only. The app
  must not offer members a view of who knows whom.

### Phase 6. The Star, fully

- Read a City Key from its PNG carriers.
- Verify a signed record and a bound-signer challenge, so a key is tied to
  the person presenting it.
- Draw the visitor's lit vertices on the 64-vertex lattice.
- Show the Hold's count beside the key. The Hold is where signed
  relationships live, so an edge formed in phase 2 or 4 is a candidate item
  for it, added by its bearer's own tools and not by this app.

Detail is in [STAR.md](STAR.md), section 6.

## 4. Threats this design accepts, and why

| Threat | Accepted because |
|---|---|
| A spoofed GPS spoofs a Meet; two colluding people can form an edge from anywhere | An edge exposes only what its owner's policy allows, and there is no score to farm |
| One person holds several avatars and links them | Same reason. This is a graph of pseudonyms until phase 5 puts a community's vetting behind membership |
| Someone gives a false name at a Meet | The name is scoped to one edge formed face to face. It is a name, not an attestation, and nothing downstream treats it as one |
| A person types something sensitive into a note | The allow-list controls which fields travel, not what someone writes in one. The interface should say who will see a note at the moment it is typed |

Threats it does not accept: a field leaking by omission (closed allow-lists),
two viewers joining their views of a third person (pairwise references), and
an edge formed without both people's consent (the Meet gates).

## 5. For a presentation before Phase 2 ships

Say what is on screen:

- The map, the trails and the quests are real.
- Alex and Margaret are authored demo people. What you see when you wear one
  is what a met peer would see, with their friends' whereabouts withheld.
- A visitor can carry their own City Key and see their own Star, checked
  against its kappa, without the file leaving the browser.
- The Meet is the next thing to build. Until it exists there are no real
  trust edges in the app.

A demo path that shows the ideas honestly:

1. Open the published map. Everyone sees the same thing.
2. Wear Alex. The map narrows to what he shows a met peer. Point out what is
   missing: his friends, the artists he has seen, his quest.
3. Put Alex down. Carry a City Key. The Star takes its colours and the panel
   reports whether the kappa matches.
4. Edit one character of the key file and carry it again. The panel reports
   the mismatch.
5. Connect a chat model and ask who you are. It knows the avatar's name and
   progress. It does not know the email, the avatar id or the full wallet.

## 6. Do not claim

- **Zero knowledge.** Nothing here is a zero-knowledge proof. The circuits in
  the exploration note are unwritten.
- **Personhood.** The graph is a graph of pseudonyms. OpenVTC's personhood
  marker is a hint a community's governance may or may not honour, and one
  person can hold two memberships.
- **Location integrity.** A spoofed GPS spoofs a Meet.
- **That a shown name is true**, or that a note is safe to share.
- **Counter-signed relationship credentials.** Today each side issues its
  own; counter-signing is planned.
- **A two-voucher join policy.** It is the intent, not what is active; joins
  today are approved by an admin.
- **That the client mints persona credentials**, or that an r-card
  specification exists. Neither is true yet.
- **That a matching kappa identifies a person.**
- **That the place layer is part of OpenVTC.** OpenVTC has no map, place or
  location credential. The location enhancement is this project's own and
  should be presented as that.
- **A live OpenVTC integration.** Nothing in this repo talks to a VTA or VTC.

## 7. Checking work against the model

In this repo:

```bash
cd clients/field-guide-web4-client && npm install && npm run build
cd ../../finsbury-guide && npm install && npm test
```

Against the counter-spec, from a checkout of `mitchuski/agentprivacy-docs`
and of `mitchuski/dtgwg-zkp-mage`:

```bash
cd research/fieldguide/runtimes
DTG_LAB=/path/to/dtgwg-zkp-mage node verify.mjs
```

That runs 8 suites and 124 properties. The same folder has `fixtures/` with
the rejection register and test vectors, and `consumer-py/`, a second
implementation in another language that must agree byte for byte. When a
phase lands here, port the relevant properties into `finsbury-guide` tests
under their own names so a failure points back at the model.
