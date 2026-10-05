export type FeatureCollection = {
  type: "FeatureCollection"
  features: unknown[]
  layerCounts?: Record<string, number>
}

type OpenAiBridge = {
  toolOutput?: unknown
  toolResponseMetadata?: unknown
}

function asCollection(node: unknown): FeatureCollection | null {
  if (!node || typeof node !== "object") return null
  const rec = node as Record<string, unknown>
  if (rec.type === "FeatureCollection" && Array.isArray(rec.features)) {
    return rec as FeatureCollection
  }
  return null
}

/** Walk ChatGPT / MCP Apps tool-result envelopes until a FeatureCollection is found. */
export function geojsonFromToolResult(payload: unknown, openai?: OpenAiBridge | null): FeatureCollection | null {
  const seen = new Set<unknown>()

  function walk(node: unknown): FeatureCollection | null {
    const direct = asCollection(node)
    if (direct) return direct
    if (!node || typeof node !== "object") return null
    if (seen.has(node)) return null
    seen.add(node)
    const rec = node as Record<string, unknown>
    const nested = [rec.geojson, rec.structuredContent, rec.result, rec.params, rec._meta, rec.mcp_tool_result, rec.call_tool_result]
    for (const child of nested) {
      const found = walk(child)
      if (found) return found
    }
    if (Array.isArray(rec.content)) {
      for (const item of rec.content) {
        if (!item || typeof item !== "object") continue
        const text = (item as { text?: unknown }).text
        if (typeof text !== "string") continue
        const trimmed = text.trim()
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue
        try {
          const found = walk(JSON.parse(trimmed))
          if (found) return found
        } catch {
          /* not JSON */
        }
      }
    }
    return null
  }

  return walk(payload) || walk(openai?.toolOutput) || walk(openai?.toolResponseMetadata)
}
