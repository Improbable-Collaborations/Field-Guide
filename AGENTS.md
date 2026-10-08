# For coding agents working in this repo

The Finsbury guide draws on two bodies of outside work: the agentprivacy
canon (the Star, the City Key, the Swordsman and Mage) and OpenVTC (verifiable
relationships and communities). Both have their own sources of truth. This
repo follows them and does not redefine them.

What lives here is the map and the guide. This is OpenVTC enhanced by
location: relationships and membership are OpenVTC's, and the place layer
(witnessing a pin, meeting in person, a community's shared streets) is this
project's own.

Before changing anything under `finsbury-guide/src/trustGraph/`,
`finsbury-guide/src/profile/`, `finsbury-guide/src/mcp/` or the peer fields in
`clients/field-guide-web4-client/`, read these three files in order:

1. [docs/agentprivacy/REFERENCE_MAP.md](docs/agentprivacy/REFERENCE_MAP.md):
   where each idea is defined and which source wins when two disagree.
2. [docs/agentprivacy/STAR.md](docs/agentprivacy/STAR.md): what the Star is,
   what this Guide adds on top of it, and the rules for touching it.
3. [docs/agentprivacy/COMMUNITY_MAP_PLAN.md](docs/agentprivacy/COMMUNITY_MAP_PLAN.md):
   the build path to an in-person community map, phase by phase, with the
   acceptance tests for each phase.

## Rules that hold everywhere

- **Fetch the source, do not recall it.** The canon and OpenVTC both move.
  Open the linked file before you rely on a constant, a field name or a
  credential type.
- **Projections are closed allow-lists.** Anything shown to another person or
  sent to a chat model starts empty and copies named fields. Never spread a
  whole record and delete from it. Every projection has a test that bolts a
  junk field on and asserts it does not come out.
- **Audience is granted, never computed.** No similarity, no shared quest, no
  graph distance creates or widens what one person may see of another.
- **No raw identifiers across a trust edge.** A peer is a pairwise reference
  and a name chosen for that edge. An avatar id, an email or a profile name
  never rides on a pin.
- **A demo is labelled as a demo.** Authored people and fixture edges say so
  in the interface and in the code.
- **Do not claim what is not built.** The list is in section 5 of the
  community map plan. If copy, a README or a slide says more than that list
  allows, it is wrong.

## Where things are

| Path | What |
|---|---|
| `finsbury-guide/src/trustGraph/personas.ts` | The two authored demo people. Full records, as their owner would hold them |
| `finsbury-guide/src/trustGraph/promise.ts` | What a viewer is shown of those records, by audience |
| `finsbury-guide/src/trustGraph/cityKey.ts` | Reads a visitor's City Key and checks its kappa |
| `finsbury-guide/src/trustGraph/starScene.ts`, `tetra.ts`, `starGlyph.ts` | The star panel and its geometry |
| `finsbury-guide/src/trustGraph/liveFeed.ts`, `guideView.ts` | Filtering the map and live events by a worn graph |
| `finsbury-guide/src/profile/contextPack.ts` | What a connected chat model receives |
| `finsbury-guide/src/mcp/` | The connector that serves that pack |
| `clients/field-guide-web4-client/src/types.ts` | The pin type, including the reserved peer fields |

## Before you hand work back

```bash
cd clients/field-guide-web4-client && npm install && npm run build
cd ../../finsbury-guide && npm install && npm test && npm run build
```

Then check your change against this list:

- [ ] Does anything new reach another person or a chat model? If so it goes
      through a closed allow-list, with a junk-field test.
- [ ] Does anything new put an identifier on a pin? It is a pairwise
      reference or it does not ship.
- [ ] Does anything create or widen access without the owner granting it?
      Remove it.
- [ ] Did you give a part of the Star a meaning? Find it at the source or
      label it as this Guide's own.
- [ ] Did you touch the City Key reader? The seven conformance cases still
      pass, and the list of fields read is unchanged or updated in
      `docs/agentprivacy/STAR.md`.
- [ ] Does any copy, README line or comment claim something on the "do not
      claim" list?
- [ ] Is a demo still labelled as a demo?
