# The Star in this Guide

How the Star is defined at its source, what this Guide does with it, and the
rules for changing either. Every source named here is linked in
[REFERENCE_MAP.md](REFERENCE_MAP.md), section 1. Where this page and a source
disagree, the source is right and this page needs fixing.

## 1. What the Star is

The Star is one person's view of their own privacy position, drawn from a
file they carry. The source's own words: it is where "what you have learned,
the artefacts you carry, the promises you make and the relationships you can
see" take shape. It has three parts: a lattice, a core and a key.

### 1.1 The lattice

Sixty-four vertices, one for each combination of six yes/no dimensions.

| Bit | Value | Dimension |
|---|---|---|
| d1 | 32 (high bit) | Protection |
| d2 | 16 | Delegation |
| d3 | 8 | Memory |
| d4 | 4 | Connection |
| d5 | 2 | Computation |
| d6 | 1 (low bit) | Value |

A vertex number written in binary reads d1 to d6 from left to right. Three
anchors to check any implementation against:

| Vertex | Binary | Dimensions set |
|---|---|---|
| 38 | `100110` | Protection, Connection, Computation |
| 25 | `011001` | Delegation, Memory, Value |
| 41 | `101001` | Protection, Memory, Value |

If your code gives a different reading for vertex 38, it is reading d1 at the
low bit, and it is wrong.

The constants, as the source states them:

```text
BITS = 6, N = 64                      the lattice, integers mod 64
STRATA = [1, 6, 15, 20, 15, 6, 1]     vertices per count of set bits
neg(x)  = (64 - x) mod 64             the Swordsman's move: protect
bnot(x) = 63 - x                      the Mage's move: project
succ    = neg after bnot = x + 1      the wheel: visits all 64
boundary = 96 edges                   64 succ steps plus 32 chords
```

A vertex's stratum is how many of its six bits are set. Stratum 0 is full
transparency; stratum 6 is full sovereignty. A person lights the vertices
they have reached.

### 1.2 The core

Two tetrahedra crossing through each other, the shape called a stella
octangula.

```text
Swordsman  [ 1, 1, 1] [ 1,-1,-1] [-1, 1,-1] [-1,-1, 1]
Mage       [-1,-1,-1] [-1, 1, 1] [ 1,-1, 1] [ 1, 1,-1]
```

The Swordsman protects what the person keeps. The Mage works with what the
person chooses to project. The white heart where the two cross stands for the
person, reachable only through both. The Mage tetrahedron is drawn at the
Swordsman's size divided by the key's size ratio, which runs from 1 to 2.2.

In this repo the two arrays are named `TET_BOOKS` (Swordsman) and
`TET_PEOPLE` (Mage) in `finsbury-guide/src/trustGraph/starGlyph.ts`. The
names are historical. The coordinates, faces, subdivision and blend factor in
`tetra.ts` are a port of the source renderer and carry its licence notice.

### 1.3 The City Key

A JSON file, exported as `city-key.json`. The fields, and what this Guide is
allowed to do with each:

| Field | Holds | This Guide |
|---|---|---|
| `name`, `version` | A label and the format version (1) | Reads `name` for display |
| `palette` `{cool, warm, sword, mage}` | Four colours | Reads `sword` and `mage` |
| `descriptions` `{"0".."63"}` | The bearer's own words per vertex | Does not read. These are personal text |
| `geometry` `{eps, m, n, core, smRatio}` | The chosen shape | Reads `smRatio` |
| `figures` `{shapeCanon, overlap, ratio, visibility[6], zkp}` | Measured values. When present they pin the shape | Reads `ratio`, which overrides `geometry.smRatio` |
| `lit` `[0..63]` | Vertices the bearer has reached | Counts them |
| `identity` `{displayName, trustTier, stratum, drakeOrb}` | Self-described identity | Does not read |
| `trace`, `focus`, `witness` | The bearer's walk of the lattice | Does not read |
| `packets` `{root, count}` | A digest of the bearer's proof packets | Does not read. Must survive any round trip untouched |
| `holds` `{root, count}` | A digest of the Hold | Does not read yet |
| `did` | The bearer's identifier, optional | Does not read |
| `prior` | The kappa of the key this one descends from | Part of the kappa check only |
| `kappa` | The content label | Checks it |

The reader in `finsbury-guide/src/trustGraph/cityKey.ts` returns exactly
seven values (`name`, `sword`, `mage`, `smRatio`, `lit`, `kappa`, `verdict`)
and a test asserts that list. To read another field, add it to the reader,
add it to this table, and say why.

### 1.4 Kappa

Kappa is a content label: `"sha256:"` followed by the hex SHA-256 of the
key's canonical form.

The canonical form:

- object keys sorted recursively, in plain code-unit order;
- array order kept;
- primitives written as `JSON.stringify` writes them;
- no whitespace;
- the top-level `kappa` field left out, and nothing else left out. Unknown
  fields stay in. `prior` stays in.

This is not RFC 8785. Do not swap in a JCS library.

A reader gives one of three verdicts:

| Verdict | Meaning |
|---|---|
| `authentic` | The key has a kappa and it matches the re-derived one |
| `unnamed` | The key has no kappa |
| `mismatch` | The key has a kappa and the bytes no longer produce it |

The conformance pack has seven cases covering these, including a key with an
unknown field and an unchanged re-export. All seven are vendored in
`finsbury-guide/src/trustGraph/fixtures/city-key.fixture.json` and run in
`cityKey.test.ts`.

### 1.5 How a key travels

- As the JSON file.
- Inside a PNG of the Star. Carrier A is a `tEXt` chunk before `IEND` with
  the keyword `cityKey` and the key JSON in base64. Carrier B is an `iTXt`
  chunk with the keyword `citykey` and the raw JSON. A signed image adds a
  `tEXt` chunk `cityKeySig`.
- Between the source's own pages, over a same-origin broadcast channel. That
  channel is not a way for another site to receive a key.

### 1.6 Binding a key to a person

A matching kappa does not say who is holding the file. Two more objects do
that, both defined in the conformance pack:

- **A signed record** (`agentprivacy.vta/1`): the bearer's Swordsman signs
  the canonical form of `{kind, publicKeyHex, kappa, prior, at, walks, vrcs}`
  with Ed25519. Hex case is part of the signed bytes.
- **A bound-signer challenge**: the receiver sends a nonce; the bearer signs
  the canonical form of `{nonce, kappa, audience, exp}` with the record's
  key. The receiver checks, in order: the record, kappa equality, expiry,
  the signature. The nonce is used once.

Neither is built here yet.

### 1.7 The Hold

Beside the key sits the Hold: the relationships other people have signed with
its bearer. The key carries only the Hold's root and its count. The items
stay with the bearer. The source's rule for it: "the first verb is relate,
not add."

## 2. What the Star is not

- **The eight tips have no assigned meaning.** Nothing at the source maps a
  tip to a category, a record or a person. Meaning lives in the 64 vertices
  and in the key. A conjecture in the formal specification relates the two
  tetrahedra to parity classes of a cube, at a stated confidence of about
  30%. It is a conjecture and assigns nothing to individual tips.
- **It is not a score.** No number on it ranks one person against another.
  The source says: "Do not convert a relationship into a trust score or
  invent a vertex assignment to make a scene appear complete."
- **The ceiling is a what-if.** The R(t) control on the reference page is a
  pair of sliders for exploring a scenario, labelled there as "a what-if,
  not a measurement".
- **The golden ratio is not in the shape.** The size ratio's default
  association with it is, in the specification's words, "resonance, not
  derivation".
- **A Star imports colours, not identity.** A visible Star grants nothing.
  The agent door states it: "Appearance is not identity; a content address
  is not a signed credential. Browsing and animation create no trust edge."
- **There is no embed API.** The reference page takes no URL parameters and
  no cross-site messages. The machine-readable Star is the exported key,
  which stays with its holder.

## 3. What this Guide does with it

Two separate things appear in the star panel on the map. They share a shape
and nothing else.

### 3.1 The visitor's own Star

"Carry your City Key" opens a file picker. The file is read in the browser
tab by `readCityKey`. The panel then:

- colours the two tetrahedra from `palette.sword` and `palette.mage`;
- sizes the Mage tetrahedron by the size ratio;
- shows the key's name, or "Unnamed key";
- shows the verdict: "κ matches", "κ does not match · changed since
  stamped", or "no κ on this key";
- shows how many of the 64 vertices are lit.

"Put the key down" clears all of it. The file is not stored, not sent to
OASIS, not sent to the connector and not included in the chat pack. A key
with a mismatched kappa is still drawn, with the warning, as the source's own
page does.

### 3.2 The demo legend

Wearing Alex or Margaret lays their place clusters on the tips so the panel
doubles as a map legend. This is the Guide's own convention, built on the
Star's shape. It is not part of the Star. The slot numbers 0 to 7 in
`personas.ts` are layout positions and carry no meaning from the source.

What a wearer sees is the projection in `promise.ts` at the audience the demo
person grants, never the full record. The interface marks these people as
demo.

## 4. Rules for agents

1. Take geometry and constants from the source, with its licence notice. Do
   not re-derive or restyle them.
2. Never give a tip, a colour or a face a meaning the source does not give
   it. If the Guide needs a legend, say in the code and in the interface
   that it is the Guide's legend.
3. To show a person's own position, read their City Key and use the 64
   vertices and six dimensions. Do not invent a parallel profile.
4. Read d1 as the high bit. Check vertex 38.
5. A key is read, shown and dropped. Keep a closed list of the fields taken
   from it. Do not store the file, upload it, or put it in a chat pack. A
   stable key commitment can link a person's visits, so even the kappa stays
   in the tab.
6. Show the verdict next to anything drawn from a key, and never describe a
   matching kappa as proof of who someone is.
7. Never write a key back out unless the writer round-trips every field it
   does not understand, including `packets`, `holds`, `did` and `prior`.
   This Guide does not export keys, and should not start without that.
8. Any reader of City Keys must pass the vendored conformance cases. If the
   pack upstream changes, update the vendored copy and the reader together.
9. Map relationships to vertices only under a named, versioned mapping
   published at the source. There is none today, so the Guide does not light
   or colour vertices from its own data.

## 5. Mistakes already made here, so they are not made again

| What happened | Why it was wrong | Where it was fixed |
|---|---|---|
| Clusters were described as following "Soulbis /star dual tet slots 0–7" | The source has no such slots | Header of `personas.ts` |
| A demo person's friends and their venues were shown to anyone who wore that person | Those are the friends' records. They were granted to one person, not to that person's viewers | `promise.ts`: `orbit` is never projected |
| The geometry was ported with no licence notice | The source is MIT | `tetra.ts`, `starGlyph.ts` |
| Both tetrahedra were drawn at one size | The Mage's size depends on the key | `starScene.ts`: `applyKey` |
| The panel was labelled "Personal trust graph" | No trust edge exists in the app | `index.html`, `starScene.ts` |

## 6. Not built yet

In the order they should be done:

1. Read a key from its PNG carriers (both keywords). The pack has three
   fixture images and expected chunk lists.
2. Verify a signed record and a bound-signer challenge, so a key can be tied
   to the person presenting it. The pack has the test key, a good record and
   three that must fail.
3. Draw the 64-vertex lattice with the visitor's lit vertices, alongside the
   core.
4. Show the Hold's count beside the key.

Each is placed in the wider build in
[COMMUNITY_MAP_PLAN.md](COMMUNITY_MAP_PLAN.md), phase 6.
