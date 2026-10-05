import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { formatFieldGuideContext } from "../profile/contextPack"
import { loadPersonalPhotos } from "../profile/personalPhotosApi"
import { dropPersonalPhoto } from "./dropPhoto"
import { loadAvatarGuide } from "./loadAvatarGuide"
import { loadLiveMapLayers } from "./loadLiveMapLayers"
import { buildFieldGuideMap } from "./mapGeojson"
import { PLACES } from "../places"
import { siteViewForJwt, enqueueSiteCommandForJwt, putSiteViewForJwt } from "./presence"
import { createFieldGuideWeb4Client } from "field-guide-web4-client"
import { JAB_SW1_GLOVES_QUEST_ID } from "../quests/jabSw1Gloves"
import { FINSBURY_PARK_CIRCUIT_PLACE_ID, FINSBURY_PARK_CIRCUIT_PIN_IDS } from "../quests/finsburyParkCircuit"
import { memoryStorage } from "./memoryStorage"
import { MAP_WIDGET_MIME, MAP_WIDGET_RESOURCE_META, MAP_WIDGET_URI, MAP_WIDGET_URIS, mapWidgetHtml } from "./mapWidget"
import { LOOK_WIDGET_MIME, LOOK_WIDGET_RESOURCE_META, LOOK_WIDGET_URI, LOOK_WIDGET_URIS, lookWidgetHtml } from "./lookWidget"
import { SIT_WIDGET_MIME, SIT_WIDGET_RESOURCE_META, SIT_WIDGET_URI, SIT_WIDGET_URIS, sitWidgetHtml } from "./sitWidget"
import { checkInAtPin, gpsFixFromArgs, storedChatGptLocation, trailPinById } from "./checkInAtPin"
import { sitRequiredSeconds } from "../sit/sitDwell"
import { isSitPin } from "field-guide-web4-client"
import { fieldGuideWalletToolResult } from "./walletTool"

const MAP_LAYERS = ["ra", "gig", "nearby", "trail", "place", "personal"] as const
type MapLayer = (typeof MAP_LAYERS)[number]

function isMapLayer(value: string): value is MapLayer {
  return (MAP_LAYERS as readonly string[]).includes(value)
}

async function mapLayerGeojson(jwt: string, layer: MapLayer, placeId = "") {
  const live = ["ra", "gig", "nearby"].includes(layer)
    ? await loadLiveMapLayers(jwt)
    : { raEvents: [], gigs: [], nearby: [] }
  let collectedIds: string[] = []
  let mintedIds: string[] = []
  let personalPhotos: Awaited<ReturnType<typeof loadPersonalPhotos>> = []
  if (layer === "trail" || layer === "personal") {
    const snap = await loadAvatarGuide(jwt)
    collectedIds = snap.experiences.map((e) => e.pinId)
    mintedIds = snap.experiences.filter((e) => e.minted).map((e) => e.pinId)
    if (layer === "personal" && snap.avatarId) {
      const oasis = createFieldGuideWeb4Client({
        storage: memoryStorage({ "fg-web4.jwt": jwt }),
        listCacheTtlSeconds: 0,
        configuredQuestId: JAB_SW1_GLOVES_QUEST_ID,
        source: "field-guide-mcp",
      }).config.oasisBaseUrl
      personalPhotos = await loadPersonalPhotos({ oasisBaseUrl: oasis, jwt, avatarId: snap.avatarId })
    }
  }
  return buildFieldGuideMap({
    places: PLACES,
    collectedIds,
    mintedIds,
    placeId: placeId || undefined,
    layer,
    personalPhotos,
    raEvents: live.raEvents,
    gigs: live.gigs,
    nearby: live.nearby,
  })
}

const MAP_TOOL_META = {
  ui: { resourceUri: MAP_WIDGET_URI },
  "openai/outputTemplate": MAP_WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Loading Field Guide map…",
  "openai/toolInvocation/invoked": "Map ready",
}

const MAP_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    layer: { type: "string" },
    featureCount: { type: "number" },
    layerCounts: { type: "object" },
    geojson: { type: "object" },
  },
  required: ["layer", "featureCount", "geojson"],
  additionalProperties: true,
}

export function mapToolResult(layer: string, map: Awaited<ReturnType<typeof mapLayerGeojson>>, render: boolean) {
  return {
    content: [
      {
        type: "text" as const,
        text: render
          ? `Showing ${map.features.length} ${layer} points on the Field Guide map.`
          : `Showing ${map.features.length} ${layer} points. Call field_guide_render_map with layer "${layer}" to show the map.`,
      },
    ],
    structuredContent: {
      layer,
      featureCount: map.features.length,
      layerCounts: map.layerCounts,
      geojson: map,
    },
    _meta: { geojson: map },
  }
}

function mapWidgetResource(uri = MAP_WIDGET_URI) {
  return {
    uri,
    mimeType: MAP_WIDGET_MIME,
    text: mapWidgetHtml(),
    _meta: MAP_WIDGET_RESOURCE_META,
  }
}

function lookWidgetResource(uri: string = LOOK_WIDGET_URI) {
  return {
    uri,
    mimeType: LOOK_WIDGET_MIME,
    text: lookWidgetHtml(),
    _meta: LOOK_WIDGET_RESOURCE_META,
  }
}

function sitWidgetResource(uri: string = SIT_WIDGET_URI) {
  return {
    uri,
    mimeType: SIT_WIDGET_MIME,
    text: sitWidgetHtml(),
    _meta: SIT_WIDGET_RESOURCE_META,
  }
}

const LOOK_TOOL_META = {
  ui: { resourceUri: LOOK_WIDGET_URI },
  "openai/outputTemplate": LOOK_WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Opening Look…",
  "openai/toolInvocation/invoked": "Look ready",
}

const SIT_TOOL_META = {
  ui: { resourceUri: SIT_WIDGET_URI },
  "openai/outputTemplate": SIT_WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Opening Sit…",
  "openai/toolInvocation/invoked": "Sit ready",
}

function toolArgs(request: { params: { arguments?: unknown } }): Record<string, unknown> {
  return request.params.arguments && typeof request.params.arguments === "object"
    ? (request.params.arguments as Record<string, unknown>)
    : {}
}

function toolMeta(
  request: { params?: { _meta?: unknown }; _meta?: unknown },
  extra?: { _meta?: unknown },
): unknown {
  if (request.params?._meta != null) return request.params._meta
  if (request._meta != null) return request._meta
  return extra?._meta
}

function rememberGps(jwt: string, args: Record<string, unknown>, meta?: unknown) {
  const gps = gpsFixFromArgs(args, meta, storedChatGptLocation(jwt))
  if (typeof gps === "string") return
  const live = siteViewForJwt(jwt)
  putSiteViewForJwt(jwt, {
    mode: "walk",
    selectedPlaceId: live?.selectedPlaceId || FINSBURY_PARK_CIRCUIT_PLACE_ID,
    selectedPinId: live?.selectedPinId || "",
    wearingPersonaId: live?.wearingPersonaId ?? null,
    wearingClusterId: live?.wearingClusterId ?? null,
    lat: gps.lat,
    lon: gps.lon,
    accuracyM: gps.accuracyM,
  })
}

export function fieldGuideTools() {
  return [
    {
      name: "field_guide_context",
      description:
        "This visitor's Field Guide pack: authored guides, STAR progress, live GPS, listings, and the Day After Tomorrow companion voice. Stay on that sit model when they are on that Guide. ChatGPT's street address is not GPS. Call field_guide_look for Look pins, field_guide_sit for park sits. For wallet balance and NFT assets call field_guide_wallet. Cannot edit the published Field Guide.",
      inputSchema: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Phone GPS latitude" },
          lon: { type: "number", description: "Phone GPS longitude" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          accuracyM: { type: "number" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "field_guide_progress",
      description:
        "This avatar’s progress JSON (collected pins, next step) plus live tab presence. Progress changes only when the visitor collects in Walk / Look. The published site is not writable. For wallet address, native balance, and NFT assets call field_guide_wallet. Do not treat this JSON as a wallet.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "field_guide_wallet",
      title: "OASIS Solana wallet",
      description:
        "Dedicated OASIS Solana wallet tool for this signed-in avatar. Call this for wallet address, native SOLANA balance, and NFT/collectible assets (GLOVE and trailPinId). This is the wallet inspector. There is no wallet_balance, wallet_assets, send, swap, or sign tool. Do not infer holdings from field_guide_context or field_guide_progress. Identity comes from the JWT. Read-only: does not create a wallet, mint, send, swap, or sign.",
      inputSchema: {
        type: "object",
        properties: {
          includeNfts: {
            type: "boolean",
            description: "Load OASIS NFT holdings. Default true.",
          },
          includeFieldGuide: {
            type: "boolean",
            description: "Include STAR collected pins vs on-chain glove mints. Default true.",
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    {
      name: "field_guide_map",
      description:
        "GeoJSON for one Field Guide map layer. Pass layer: ra, gig, nearby, trail, place, or personal. Returns structuredContent.geojson. Trail includes Point beacons and LineString walks. Then call field_guide_render_map with that layer to show the interactive map. Do not invent a second map.",
      inputSchema: {
        type: "object",
        properties: {
          layer: {
            type: "string",
            enum: [...MAP_LAYERS],
            description: "Required. Which map layer to return as GeoJSON.",
          },
          placeId: {
            type: "string",
            description: "Optional. Only for trail or place: one published guide id.",
          },
        },
        required: ["layer"],
        additionalProperties: false,
      },
      outputSchema: MAP_OUTPUT_SCHEMA,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    {
      name: "field_guide_render_map",
      description:
        "Render the Field Guide map widget for one layer. Call field_guide_map or field_guide_map_ra first if you need to inspect data. Pass the same layer here. This is the only tool that opens the interactive map.",
      inputSchema: {
        type: "object",
        properties: {
          layer: {
            type: "string",
            enum: [...MAP_LAYERS],
            description: "Required. Same layer as field_guide_map.",
          },
          placeId: {
            type: "string",
            description: "Optional. Only for trail or place: one published guide id.",
          },
          ids: {
            type: "array",
            items: { type: "string" },
            description: "Optional. Only these feature ids.",
          },
        },
        required: ["layer"],
        additionalProperties: false,
      },
      outputSchema: MAP_OUTPUT_SCHEMA,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
      _meta: MAP_TOOL_META,
    },
    {
      name: "field_guide_drop_photo",
        description:
          "Add a photo to this visitor's personal Field Guide layer with geocoordinates. Writes an avatar-parented OASIS holon. Does not edit published trails, mint GLOVE, or STAR-collect. Pass imageUrl or imageBase64, plus longitude/latitude, pinId, or placeId. Do not invent coordinates.",
        inputSchema: {
          type: "object",
          properties: {
            caption: { type: "string" },
            imageUrl: { type: "string", description: "https URL of the photo" },
            imageBase64: { type: "string", description: "Raw or data-URL base64 of the photo" },
            imageFileName: { type: "string" },
            imageMime: { type: "string" },
            longitude: { type: "number" },
            latitude: { type: "number" },
            lon: { type: "number" },
            lat: { type: "number" },
            pinId: { type: "string", description: "Authored trail pin id. Uses that pin's coordinates." },
            placeId: { type: "string", description: "Field Guide place id. Uses that venue's coordinates." },
          },
          additionalProperties: false,
        },
      },
    {
      name: "field_guide_open_look",
      description:
        "Open Walk Look on an already-open Field Guide browser tab. On a phone that only has ChatGPT, use field_guide_look and field_guide_check_in instead.",
      inputSchema: {
        type: "object",
        properties: {
          placeId: {
            type: "string",
            description: "Field Guide place id. Default trail-finsbury-park-circuit.",
          },
          pinId: {
            type: "string",
            description: "Trail pin id to look at. Omit for the next open pin.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "field_guide_look",
      description:
        "Open Look inside this ChatGPT chat. The visitor taps I'm here so the phone GPS is sent to field_guide_check_in. ChatGPT's street address is not a check-in. Pass pinId (hitchhiker-stoop for the doorstep smoke test). For Day After Tomorrow sits use field_guide_sit.",
      inputSchema: {
        type: "object",
        properties: {
          pinId: { type: "string" },
          lat: { type: "number" },
          lon: { type: "number" },
          accuracyM: { type: "number" },
        },
        additionalProperties: false,
      },
      _meta: LOOK_TOOL_META,
    },
    {
      name: "field_guide_sit",
      description:
        "Open Sit inside this ChatGPT chat for Day After Tomorrow. Speak as the sit companion from field_guide_context (not a breakup coach). The visitor stays in the park radius through placeholder audio. Complete sit mints the themed NFT then STAR. Do not call field_guide_check_in for a sit until this widget reports ready.",
      inputSchema: {
        type: "object",
        properties: {
          pinId: { type: "string", description: "sit-still-stone and later unlocked sit ids" },
          lat: { type: "number" },
          lon: { type: "number" },
          accuracyM: { type: "number" },
        },
        additionalProperties: false,
      },
      _meta: SIT_TOOL_META,
    },
    {
      name: "field_guide_check_in",
      description:
        "Record that this avatar is at a pin. GPS must be inside radiusM. The Look widget I'm here button supplies lat/lon. Sit pins also need dwellSeconds and audioSecondsPlayed from field_guide_sit. Do not geocode a street address. Do not invent coordinates. Do not mark complete unless this tool returns ok.",
      inputSchema: {
        type: "object",
        properties: {
          pinId: { type: "string" },
          lat: { type: "number", description: "Phone GPS latitude from Look I'm here or Sit." },
          lon: { type: "number", description: "Phone GPS longitude from Look I'm here or Sit." },
          latitude: { type: "number" },
          longitude: { type: "number" },
          accuracyM: { type: "number" },
          dwellSeconds: { type: "number", description: "Seconds in radius. Required for sit pins." },
          audioSecondsPlayed: { type: "number", description: "Sit audio seconds actually played." },
          skipDetected: { type: "boolean" },
        },
        required: ["pinId"],
        additionalProperties: false,
      },
      _meta: { "openai/widgetAccessible": true, ui: { visibility: ["model", "app"] } },
    },
    ...MAP_LAYERS.map((layer) => ({
      name: `field_guide_map_${layer}`,
      description: `GeoJSON Point features for the Field Guide ${layer} layer. No arguments. Then call field_guide_render_map with layer "${layer}" to show the map.`,
      inputSchema: { type: "object" as const, properties: {}, additionalProperties: false },
      outputSchema: MAP_OUTPUT_SCHEMA,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    })),
  ]
}

export function createFieldGuideMcpServer(jwt: string): Server {
  const server = new Server(
    { name: "field-guide", version: "0.6.0" },
    { capabilities: { tools: { listChanged: true }, resources: { listChanged: true } } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: fieldGuideTools(),
  }))

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      ...MAP_WIDGET_URIS.map((uri) => ({
        uri,
        name: "Field Guide map",
        description: "Interactive map for field_guide_render_map results.",
        mimeType: MAP_WIDGET_MIME,
      })),
      ...LOOK_WIDGET_URIS.map((uri) => ({
        uri,
        name: "Field Guide Look",
        description: "GPS Look overlay for field_guide_look.",
        mimeType: LOOK_WIDGET_MIME,
      })),
      ...SIT_WIDGET_URIS.map((uri) => ({
        uri,
        name: "Field Guide Sit",
        description: "Sit overlay for field_guide_sit.",
        mimeType: SIT_WIDGET_MIME,
      })),
    ],
  }))

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [],
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri
    if ((LOOK_WIDGET_URIS as readonly string[]).includes(uri)) {
      return { contents: [lookWidgetResource(uri)] }
    }
    if ((SIT_WIDGET_URIS as readonly string[]).includes(uri)) {
      return { contents: [sitWidgetResource(uri)] }
    }
    if (!(MAP_WIDGET_URIS as readonly string[]).includes(uri)) {
      throw new Error(`Unknown resource ${uri}`)
    }
    return { contents: [mapWidgetResource(uri)] }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const name = request.params.name
    const meta = toolMeta(request, extra)
    try {
      if (name === "field_guide_drop_photo") {
        const args =
          request.params.arguments && typeof request.params.arguments === "object"
            ? (request.params.arguments as Record<string, unknown>)
            : {}
        const photo = await dropPersonalPhoto(jwt, args)
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, photo }) }] }
      }
      if (name === "field_guide_open_look") {
        const args =
          request.params.arguments && typeof request.params.arguments === "object"
            ? (request.params.arguments as Record<string, unknown>)
            : {}
        const placeId =
          typeof args.placeId === "string" && args.placeId.trim()
            ? args.placeId.trim()
            : FINSBURY_PARK_CIRCUIT_PLACE_ID
        const pinId = typeof args.pinId === "string" ? args.pinId.trim() : ""
        const place = PLACES.find((p) => p.id === placeId)
        if (!place?.trailFile) throw new Error(`Unknown Field Guide trail ${placeId}.`)
        if (
          placeId === FINSBURY_PARK_CIRCUIT_PLACE_ID &&
          pinId &&
          !(FINSBURY_PARK_CIRCUIT_PIN_IDS as readonly string[]).includes(pinId)
        ) {
          throw new Error(`Unknown park pin ${pinId}.`)
        }
        const queued = enqueueSiteCommandForJwt(jwt, { type: "open-look", placeId, pinId })
        if (!queued.ok) throw new Error(queued.message)
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                command: queued.command,
                message:
                  "Queued Walk Look on the Field Guide tab. If the visitor only has ChatGPT on a phone, call field_guide_look instead.",
              }),
            },
          ],
        }
      }
      if (name === "field_guide_wallet") {
        const args = toolArgs(request)
        return await fieldGuideWalletToolResult(jwt, args)
      }
      if (name === "field_guide_check_in") {
        const args = toolArgs(request)
        rememberGps(jwt, args, meta)
        const done = await checkInAtPin(jwt, args, meta)
        if (!done.ok) throw new Error(done.message)
        return { content: [{ type: "text", text: JSON.stringify(done) }] }
      }
      if (name === "field_guide_look") {
        const args = toolArgs(request)
        rememberGps(jwt, args, meta)
        const snap = await loadAvatarGuide(jwt)
        const pinId =
          (typeof args.pinId === "string" && args.pinId.trim()) ||
          snap.nextStep?.pinId ||
          FINSBURY_PARK_CIRCUIT_PIN_IDS[0]
        const pin = trailPinById(pinId)
        if (!pin) throw new Error(`Unknown pin ${pinId}.`)
        const gps = gpsFixFromArgs(args, meta, storedChatGptLocation(jwt))
        const structured = {
          pinId: pin.id,
          title: pin.title,
          lat: pin.lat,
          lon: pin.lon,
          radiusM: pin.radiusM,
          narrationText: pin.narrationText,
          directionHint: pin.directionHint,
          visitor:
            typeof gps === "string"
              ? { message: "Widget will read phone GPS." }
              : { lat: gps.lat, lon: gps.lon, accuracyM: gps.accuracyM },
        }
        return {
          content: [
            {
              type: "text",
              text: `Look: ${pin.title}. In radius, tap I'm here or call field_guide_check_in with this phone's lat/lon.`,
            },
          ],
          structuredContent: structured,
          _meta: { ui: { resourceUri: LOOK_WIDGET_URI }, ...structured },
        }
      }
      if (name === "field_guide_sit") {
        const args = toolArgs(request)
        rememberGps(jwt, args, meta)
        const snap = await loadAvatarGuide(jwt)
        const pinId =
          (typeof args.pinId === "string" && args.pinId.trim()) ||
          (snap.nextStep?.pinId && isSitPin({ id: snap.nextStep.pinId }) ? snap.nextStep.pinId : "") ||
          "sit-still-stone"
        const pin = trailPinById(pinId)
        if (!pin || !isSitPin(pin)) throw new Error(`Unknown sit ${pinId}.`)
        const gps = gpsFixFromArgs(args, meta, storedChatGptLocation(jwt))
        const structured = {
          pinId: pin.id,
          title: pin.title,
          lat: pin.lat,
          lon: pin.lon,
          radiusM: pin.radiusM,
          requiredSeconds: sitRequiredSeconds(pin),
          audioUrl: pin.audioUrl,
          imageUrl: pin.imageUrl,
          narrationText: pin.narrationText,
          visitor:
            typeof gps === "string"
              ? { message: "Widget will read phone GPS." }
              : { lat: gps.lat, lon: gps.lon, accuracyM: gps.accuracyM },
        }
        return {
          content: [
            {
              type: "text",
              text: `Sit: ${pin.title}. Stay in the radius through the placeholder audio. Completing mints this token and unlocks the next sit.`,
            },
          ],
          structuredContent: structured,
          _meta: { ui: { resourceUri: SIT_WIDGET_URI }, ...structured },
        }
      }
      if (name === "field_guide_render_map" || name === "field_guide_map" || name.startsWith("field_guide_map_")) {
        const args =
          request.params.arguments && typeof request.params.arguments === "object"
            ? (request.params.arguments as Record<string, unknown>)
            : {}
        const fromName = name.startsWith("field_guide_map_") ? name.slice("field_guide_map_".length) : ""
        const layerRaw = fromName || (typeof args.layer === "string" ? args.layer.trim().toLowerCase() : "")
        if (!isMapLayer(layerRaw)) {
          throw new Error("Pass layer: ra, gig, nearby, trail, place, or personal.")
        }
        const placeId = typeof args.placeId === "string" ? args.placeId : ""
        let map = await mapLayerGeojson(jwt, layerRaw, placeId)
        if (name === "field_guide_render_map" && Array.isArray(args.ids) && args.ids.length) {
          const wanted = new Set(args.ids.filter((id): id is string => typeof id === "string"))
          map = {
            ...map,
            features: map.features.filter((f) => wanted.has(String(f.properties.id || ""))),
          }
        }
        return mapToolResult(layerRaw, map, name === "field_guide_render_map")
      }
      const snap = await loadAvatarGuide(jwt)
      const args = toolArgs(request)
      rememberGps(jwt, args, meta)
      const live = siteViewForJwt(jwt)
      const listings = await loadLiveMapLayers(jwt)
      if (name === "field_guide_context") {
        return { content: [{ type: "text", text: formatFieldGuideContext(snap, live, listings) }] }
      }
      if (name === "field_guide_progress") {
        return {
          content: [{ type: "text", text: JSON.stringify({ ...snap, site: live }, null, 2) }],
        }
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ error: true, message: `Unknown tool ${name}` }) }],
        isError: true,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Field Guide MCP failed"
      return {
        content: [{ type: "text", text: JSON.stringify({ error: true, message }) }],
        isError: true,
      }
    }
  })

  return server
}
