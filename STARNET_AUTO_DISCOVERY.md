# Celestial Cyberspace — STARNET Auto-Discovery

> Any OAPP registered in STARNET automatically appears as a celestial body in the galaxy.
> No manual entry. No code change. No PR required.

---

## How It Works

2 seconds after the galaxy loads, `fetchStarnetOapps()` runs:

```
1. Calls the OASIS API for all registered OAPPs
2. Skips any already in the curated static list (by oappId)
3. Converts each new OAPP into a cyan 'oapp' celestial body
4. Adds it to the Outer Discovery Arm of the galaxy
5. It's immediately clickable — info panel shows name, description, OAPP ID, live stats
```

This runs every time the page loads, so new OAPPs appear the moment the viewer refreshes.

---

## For OAPP Authors

You do not need to touch `index.html`. Just register and publish your OAPP:

```
# Step 1 — Beam in
star_beam_in(username, password)

# Step 2 — Register
star_create_oapp(name: "YourApp", description: "What it does", oappType: 5)
→ note the OAPP ID

# Step 3 — Publish
star_publish_oapp(id: "YOUR-ID", sourcePath: "...", launchTarget: "...")

# Step 4 — Activate
star_activate_oapp(id: "YOUR-ID")

# Done — open the galaxy and your OAPP appears automatically
```

---

## Position Assignment

Your OAPP's galaxy position is derived **deterministically from its UUID**:

```
hex = uuid.replace(/-/g, '')
angle  = hex[0..7]  → 0–360° around the galaxy plane
radius = hex[8..15] → 28–48 units from the centre (Outer Discovery Arm)
y      = hex[16..23]→ -4 to +4 units vertical depth
```

The same OAPP always appears at the same position. No two OAPPs collide (UUID space is vast).

### Optional: Encode a Specific Position

Set `ourWorldLat` and `ourWorldLong` when registering to request a specific galaxy location:

| Field | Range | Maps to galaxy axis |
|-------|-------|---------------------|
| `ourWorldLat` | -90 → +90 | x: -45 → +45 |
| `ourWorldLong` | -180 → +180 | z: -45 → +45 |

If both are 0 (the default), UUID-derived positioning is used.

---

## For Galaxy Operators

To enable live STARNET discovery, set these before the galaxy script loads:

```html
<script>
  // Point at your OASIS WebAPI instance
  window.__OASIS_API__ = 'http://localhost:5001';

  // Optional: provide a JWT for authenticated access (shows ALL OAPPs, not just public ones)
  // Without this, only published public OAPPs appear
  window.__OASIS_JWT__ = 'eyJhbGci...';
</script>
```

To get a fresh JWT:

```bash
curl -X POST http://localhost:5001/api/Avatar/Authenticate \
  -H "Content-Type: application/json" \
  -d '{"username":"OASIS_ADMIN","password":"YOUR_PASSWORD"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['result']['jwtToken'])"
```

Paste the output as `window.__OASIS_JWT__`.

---

## Auth Modes

| Mode | How | What appears |
|------|-----|-------------|
| **Unauthenticated** | No `__OASIS_JWT__` set | Published + active public OAPPs only |
| **Authenticated** | `__OASIS_JWT__` set | All OAPPs belonging to the authenticated avatar |

---

## Static vs Dynamic Entries

| Entry type | Source | Rich metadata | Position |
|------------|--------|--------------|----------|
| Curated | `SYSTEMS` array in `index.html` | Full (subtitle, sector, region, links) | Hand-placed |
| Auto-discovered | STARNET live fetch | Name + description from registration | UUID-derived (outer arm) |

Static entries always win — if your OAPP ID already appears in the static list, the dynamic fetch skips it. This means curated apps keep their hand-crafted descriptions while new OAPPs appear automatically alongside them.

To upgrade an auto-discovered OAPP to a curated entry (richer info panel), add it to the `SYSTEMS` array with the `oappId` field set to your UUID.

---

## Updating Your OAPP's Description

The galaxy displays whatever `description` is stored in STARNET. To update it:

```
star_update_oapp(id: "YOUR-ID", description: "New richer description for the galaxy panel")
```

Changes appear on the next page load.

---

## Tested OAPP Positions (UUID → galaxy)

| OAPP | UUID | Galaxy position | Radius |
|------|------|----------------|--------|
| Pan Galactic Monitor | `b0bf0be6-...` | `[-12.2, 1.3, -31.0]` | 33.3 |
| Pan Galactic Timebank | `06ee81c2-...` | `[33.7, 1.2, 5.8]` | 34.2 |

Both are in the static `SYSTEMS` array with `oappId` set, so the dynamic fetch skips them. Any new OAPP will land at its own deterministic position in the outer ring.
