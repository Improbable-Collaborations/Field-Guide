import type { FieldGuideWeb4ClientConfig } from "./config.js"

export type {
  TrailPin,
  QuestObjectiveLite,
  QuestSummary,
  PlacePinRequest,
  DropSpec,
  DropResult,
  OasisSessionState,
  AuthResult,
  ApiResult,
  PlacePinResult,
  CheckInResult,
  NearbyArgs,
} from "./types.js"

/** Peel OASISResult wrappers (result / Result) and detect isError. */
export function unwrapResult(root: unknown): unknown {
  if (root == null || typeof root !== "object") return root
  const obj = root as Record<string, unknown>
  let node: unknown = obj.result ?? obj.Result ?? root
  if (node != null && typeof node === "object") {
    const inner = node as Record<string, unknown>
    if (inner.result != null || inner.Result != null) {
      node = inner.result ?? inner.Result
    }
  }
  return node
}

export function isErrorBody(root: unknown): { isError: boolean; message: string } {
  if (root == null || typeof root !== "object") {
    return { isError: false, message: "" }
  }
  const obj = root as Record<string, unknown>
  const flagged = obj.isError === true || obj.IsError === true
  const message = String(obj.message ?? obj.Message ?? (flagged ? "isError" : ""))
  return { isError: flagged, message }
}

export function readString(node: unknown, ...keys: string[]): string {
  if (node == null || typeof node !== "object") return ""
  const obj = node as Record<string, unknown>
  for (const key of keys) {
    const v = obj[key]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

export function readNumber(node: unknown, ...keys: string[]): number {
  if (node == null || typeof node !== "object") return NaN
  const obj = node as Record<string, unknown>
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return NaN
}

export function readBool(node: unknown, ...keys: string[]): boolean {
  if (node == null || typeof node !== "object") return false
  const obj = node as Record<string, unknown>
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "boolean") return v
    if (v === "true") return true
    if (v === "false") return false
  }
  return false
}

export type HttpClient = {
  config: FieldGuideWeb4ClientConfig
  fetch: typeof fetch
  getJwt: () => string | null
  onUnauthorized: () => void
}

export async function requestJson(
  http: HttpClient,
  url: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<{ status: number; text: string; json: unknown }> {
  const headers = new Headers(init.headers)
  if (!headers.has("Content-Type") && init.body != null) {
    headers.set("Content-Type", "application/json")
  }
  if (init.auth !== false) {
    const jwt = http.getJwt()
    if (jwt) headers.set("Authorization", `Bearer ${jwt}`)
  }

  const res = await http.fetch(url, { ...init, headers })
  const text = await res.text()
  if (res.status === 401) http.onUnauthorized()

  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  return { status: res.status, text, json }
}

export function oasisUrl(http: HttpClient, path: string): string {
  const base = http.config.oasisBaseUrl.replace(/\/$/, "")
  return path.startsWith("/") ? base + path : `${base}/${path}`
}

export function starUrl(http: HttpClient, path: string): string {
  const base = http.config.starBaseUrl.replace(/\/$/, "")
  return path.startsWith("/") ? base + path : `${base}/${path}`
}

export function nuvaUrl(http: HttpClient, path: string): string {
  const base = (http.config.nuvaBaseUrl ?? "https://app.nuva.finance").replace(/\/$/, "")
  return path.startsWith("/") ? base + path : `${base}/${path}`
}
