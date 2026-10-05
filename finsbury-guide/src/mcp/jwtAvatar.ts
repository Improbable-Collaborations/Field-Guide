const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function avatarIdFromJwt(jwt: string): string {
  const part = jwt.split(".")[1]
  if (!part) return ""
  try {
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    const payload = JSON.parse(json) as Record<string, unknown>
    for (const key of ["avatarId", "AvatarId", "nameid", "sub"]) {
      const v = payload[key]
      if (typeof v === "string" && GUID.test(v)) return v
    }
    for (const v of Object.values(payload)) {
      if (typeof v === "string" && GUID.test(v)) return v
    }
  } catch {
    return ""
  }
  return ""
}
