# Reference map

Where each idea this Guide borrows is defined, what to take from each source,
and what not to. Every link is public. Open the source before relying on it:
these projects change week to week, and the versions noted here were read on
2026-10-04.

Within each table, a source higher up wins over one lower down.

## 0. Find the source for a question

| If you are asking | Read |
|---|---|
| What is a vertex, a stratum, a dimension? | 1.1 `star/CLAUDE.md`, then the formal specification section 12.6 |
| Which bit is Protection? | 1.1 `star/CLAUDE.md`: d1 is the high bit |
| What fields does a City Key have? | 1.1 `star/CLAUDE.md`, "City Key" |
| How is kappa computed? | 1.2 the conformance pack README |
| How do I read a key out of a PNG? | 1.2 the conformance pack, `png-carrier.fixture.json` |
| How do I know the person holding a key made it? | 1.2 the conformance pack: the signed record and the challenge |
| What do the two tetrahedra mean? | 1.1 `soulbis.com/guide` and the renderer source |
| What may another person see of my places? | 2 the counter-spec, section 3 |
| How do two people form an edge? | 2 the counter-spec, section 2; then 3 `relationships-vrcs.md` |
| What must the client send? | 2 the counter-spec, section 6 |
| What is a relationship credential, and when is an edge complete? | 3 `personhood-and-graph.md` |
| Which credential types exist today? | 3 `credentials.md` |
| How does a community admit a member? | 3 `community-lifecycle.md` and the joining walkthrough |
| How does a chat agent act for a person? | 3 `personal-ai-agents.md` |
| What can we honestly say on a slide? | [COMMUNITY_MAP_PLAN.md](COMMUNITY_MAP_PLAN.md), section 6 |

## 1. The Star and the City Key

### 1.1 Definitions

| Read | Take from it | Do not take from it |
|---|---|---|
| [mitchuski/star · CLAUDE.md](https://github.com/mitchuski/star/blob/main/CLAUDE.md) | The canon constants, the bit order with its three anchor vertices, the full City Key schema, the kappa rules | Its notes on keeping two copies of the pages in sync; they concern that repo only |
| [mitchuski/star · star/index.html](https://github.com/mitchuski/star/blob/main/star/index.html), live at [soulbis.com/star](https://soulbis.com/star/) | The reference renderer: tetrahedron coordinates, face and edge lists, the subdivision and blend, the kappa functions, the PNG writer and reader | The ceiling sliders as data. They are a scenario control |
| [soulbis.com/guide](https://soulbis.com/guide/) | What the Star and the Hold are, in plain words | |
| [agentprivacy-docs · papers/v6/privacy_value_v6_formal_specification.md](https://github.com/mitchuski/agentprivacy-docs/blob/main/papers/v6/privacy_value_v6_formal_specification.md) | The six dimensions (section 12.6); the reconstruction ceiling (section 5.5); conjectures C88 and C89 about the tetrahedra | Any conjecture as fact. Each carries a stated confidence; quote it with that number or not at all |
| [mitchuski/star-key · docs](https://github.com/mitchuski/star-key/tree/main/docs) | The Star Key browser extension; the reading format `star-reading/0.1` and the registry entry format; `VERTEX_PATHWAYS.md` for how shared values could become a Star | `VERTEX_PATHWAYS.md` is labelled design direction. It is not a mapping to implement |

### 1.2 Conformance

| Read | Take from it |
|---|---|
| [agentprivacy-mcp · fixtures/star-hold-conformance](https://github.com/mitchuski/agentprivacy-mcp/tree/main/fixtures/star-hold-conformance) | The byte-level rules: canonical form, kappa, the signed record, the bound-signer challenge, both PNG carriers, the Merkle root rule. Seven key cases, three failing records, three fixture images, and `verify.mjs`, a checker with no dependencies |
| [mitchuski/star · HOW_THE_SIGIL_WORKS.md](https://github.com/mitchuski/star/blob/main/HOW_THE_SIGIL_WORKS.md) | The implementer's card for kappa and the PNG carrier, with a conformance vector |
| [mitchuski/agentprivacy-mcp · README](https://github.com/mitchuski/agentprivacy-mcp) | The Swordsman as a separate process that holds the signing key and signs after a policy check; the Mage as the process that verifies and holds nothing; the tools `key_derive`, `key_evolve`, `sigil_render`, `lattice_move` |

`city-key.fixture.json` from the pack is vendored at
`finsbury-guide/src/trustGraph/fixtures/`. It was copied at upstream commit
`22c39d0`. When the pack changes, replace the copy and re-run the tests.

### 1.3 Doors written for agents

| Read | Take from it |
|---|---|
| [agentprivacy.ai/skill.md](https://agentprivacy.ai/skill.md) | The entry point for an agent arriving anywhere in this work |
| [soulbis.com/skill.md](https://soulbis.com/skill.md), [soulbis.com/llms.txt](https://soulbis.com/llms.txt) | What the Star host offers and what a fetch there does not do |
| [mages.city/city-key-arrival.md](https://mages.city/city-key-arrival.md) | What a receiving place reads out of a key and what it never reads. This is the nearest thing to a guide for an app like this one, which also receives keys |

Three sentences from those doors that bind this repo:

- "A Star imports colours, not identity."
- "Appearance is not identity; a content address is not a signed credential.
  Browsing and animation create no trust edge."
- "Map selected relationships to vertices only under a named, versioned
  mapping … Do not convert a relationship into a trust score or invent a
  vertex assignment to make a scene appear complete."

### 1.4 Licences

| Source | Licence |
|---|---|
| `mitchuski/star`, `mitchuski/soulbis`, `mitchuski/agentprivacy-mcp` | MIT |
| `mitchuski/star-key` | Apache-2.0 |
| `mitchuski/agentprivacy-docs` | CC BY 4.0 for documents, MIT for code |
| `soulbis.com/skill.md` | CC BY-SA 4.0 |

Keep the notice when you port code. `finsbury-guide/src/trustGraph/tetra.ts`
and `starGlyph.ts` carry one for the geometry.

## 2. The trust layer for a walking map

All in [agentprivacy-docs · research/fieldguide](https://github.com/mitchuski/agentprivacy-docs/tree/main/research/fieldguide).

| Read | Take from it | Watch for |
|---|---|---|
| `COUNTER-SPEC-meet-and-overlay.md` | The model this Guide's trust layer follows. Section 0: the two rulings on quest edges and on the identifier leak. Section 2: the Meet rite. Section 3: disclosure. Section 4: the overlay, erosion, wire names, venue stewards. Section 6: what the client must send. Section 7: what the model does not establish | It answers specifications that live in the OASIS repository; where it cites a section number of those, the counter-spec's own text is enough to build from |
| `runtimes/` | The executable model. `verify.mjs` runs 8 suites and 124 properties. `fixtures/register.mjs` is the closed list of 22 rejection codes. `fixtures/vectors.json` is the test vectors. `consumer-py/` is a second implementation that must agree byte for byte | `verify.mjs` needs a checkout of the lab below, passed as `DTG_LAB` |
| `NOTE-oasis-cred-spec-alignment.md` | The ordered list of changes that bring an avatar-based graph into line with the credential specification | **Its credential type names are out of date.** It names `WitnessCredential`, `EndorsementCredential` and a `firstperson.network` context. OpenVTC now refuses all three. Use section 3 below for types |
| `NOTE-zk-path-for-arworld.md` | What could later be proved in zero knowledge, and its cost | Nothing in it is built |
| `QUESTION-MAP.md`, `REFLECTION-MAP.md` | Which open question each property answers; where the model matches its upstream lab and where it departs | |

Upstream of that model:

| Read | Take from it |
|---|---|
| [mitchuski/dtgwg-zkp-mage](https://github.com/mitchuski/dtgwg-zkp-mage) · `explorations/X11-field-guide-deployment.md` | How the field guide model was derived from the lab, gate by gate |
| Same repo · `runtimes/07-trust-graph-formation`, `runtimes/01-uniqueness-nullifier` | The lab runtimes the model imports and is checked against |

One finding from that work to carry into any second implementation: rounding
differs between languages. JavaScript's rounding and the half-to-even
rounding of Python and C# disagree on a tie, and at coarse location that is
a difference of about 110 m. Pin the rounding mode at the boundary.

## 3. OpenVTC

| Read | Take from it | Watch for |
|---|---|---|
| [verifiable-trust-infrastructure · docs/03-vtc/personhood-and-graph.md](https://github.com/OpenVTC/verifiable-trust-infrastructure/blob/main/docs/03-vtc/personhood-and-graph.md) | Relationship credentials and their `issuerScope`; half and complete edges; witnessed statements and their binding verdicts; the spoken match code; what a personhood hint is | Relationship credentials are self-issued today. Counter-signing is planned. The graph endpoint is admin-only |
| [openvtc · docs/relationships-vrcs.md](https://github.com/OpenVTC/openvtc/blob/main/docs/relationships-vrcs.md) | The handshake: request, accept, finalise; a fresh pairwise identifier per relationship by default; why pairwise is the default | The command examples are stale. The terminal app is the current path |
| [openvtc · docs/design/vetting-process.md](https://github.com/OpenVTC/openvtc/blob/main/docs/design/vetting-process.md) | In-person vetting: the vetting desk QR, the three methods (`inPerson`, `video`, `priorAcquaintance`), the directory that lists a region and never a city or coordinates | A design document. Check what has shipped |
| [verifiable-trust-infrastructure · docs/03-vtc/credentials.md](https://github.com/OpenVTC/verifiable-trust-infrastructure/blob/main/docs/03-vtc/credentials.md) | The credential types accepted today and their shapes | Retired types are refused with no alias |
| [verifiable-trust-infrastructure · docs/03-vtc/community-lifecycle.md](https://github.com/OpenVTC/verifiable-trust-infrastructure/blob/main/docs/03-vtc/community-lifecycle.md) | How a member joins: presentations to a join request, a policy evaluation, an admin decision, a membership credential delivered sealed | |
| [vti-setup · developer/03-joining-a-community.md](https://github.com/OpenVTC/vti-setup/blob/main/developer/03-joining-a-community.md) | The joining walkthrough as it works today | The two-voucher policy it describes is stated as not yet active |
| [verifiable-trust-infrastructure · docs/02-vta/personal-ai-agents.md](https://github.com/OpenVTC/verifiable-trust-infrastructure/blob/main/docs/02-vta/personal-ai-agents.md) | Enrolling an AI agent under a person's own agent: its own identifier, a least-privilege capability set, passkey step-up for sensitive actions | |
| [DTG Credentials Core Spec](https://trustoverip.github.io/dtgwg-cred-spec/), [VTI spec](https://trustoverip.github.io/dtgwg-vti-spec/) | The specifications OpenVTC implements | |

Versions read: `openvtc` 0.3.1; in the infrastructure repo, `pnm-cli`
0.30.0, `cnm-cli` 0.24.0, `vta-service` 0.50.0, `vtc-service` 0.11.58.

### Terms, as OpenVTC uses them

| Term | Meaning |
|---|---|
| **VTA**, Verifiable Trust Agent | One person's own service holding their keys, identifiers and access policies |
| **VTC**, Verifiable Trust Community | A community's service, always on top of a VTA, holding members, their credentials and the policies that gate them |
| **P-DID** | A persona identifier a person publishes. Anyone can resolve it |
| **R-DID** | An identifier made fresh for one relationship. Two people who both know a third hold different references to them |
| **VRC**, relationship credential | Issued by one person about their relationship to another. An edge is complete only when one is in force in each direction |
| **VMC**, membership credential | Issued by a community on joining. It expires, 30 days by default |
| **VSC**, statement credential | A statement under a registered predicate. A witness of a relationship is one of these, under `witnessed/1` |
| **VIC**, invitation credential | An invitation to join a community. Not a relationship invitation |
| **Personhood hint** | A marker on a membership credential. Whether it counts is the community's governance decision, not a property of the credential |

### What OpenVTC does not have

A map, a place, a location credential, or coordinates in any directory. The
place layer is this project's own. That is the point of this implementation
and also its responsibility: see "What lives here" in the plan.

## 4. Where this repo meets them

| Here | Follows | Test |
|---|---|---|
| `finsbury-guide/src/trustGraph/tetra.ts`, `starScene.ts` | The two tetrahedra of the Star's core | `starGlyph.test.ts` |
| `finsbury-guide/src/trustGraph/cityKey.ts` | The City Key canonical form and kappa | `cityKey.test.ts`, against the vendored pack |
| `finsbury-guide/src/trustGraph/promise.ts` | The disclosure tiers of the counter-spec, section 3 | `promise.test.ts` |
| `finsbury-guide/src/profile/contextPack.ts`, `mcp/createServer.ts` | The same closed allow-list rule, applied to what a chat model receives | `contextPack.test.ts` |
| `clients/field-guide-web4-client/src/types.ts` peer fields | The pairwise reference of the counter-spec, sections 0.2 and 6 | none yet; arrives with the Meet |

## 5. Keeping this map true

- If a link here stops resolving, fix the link before relying on memory of
  what it said.
- If a source says something this repo's code contradicts, the code is the
  bug.
- If you need something that no linked source defines, it is not defined.
  Say so in the pull request and ask, rather than filling the gap.
- Sources that are not linked here are not to be cited from this repo, even
  if you have seen them. Some related working material is private.
