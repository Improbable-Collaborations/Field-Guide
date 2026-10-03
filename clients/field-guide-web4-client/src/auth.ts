import type { HttpClient } from "./http.js"
import { isErrorBody, oasisUrl, readString, requestJson, unwrapResult } from "./http.js"
import type { SessionApi } from "./session.js"
import type { AuthResult } from "./types.js"

function mapAuthPayload(json: unknown, session: SessionApi): AuthResult | null {
  const err = isErrorBody(json)
  if (err.isError) return null
  const node = unwrapResult(json) as Record<string, unknown> | null
  if (!node || typeof node !== "object") return null

  const jwt =
    readString(node, "jwtToken", "JwtToken", "token", "Token") ||
    readString(json, "jwtToken", "JwtToken")
  const avatar = (node.avatar ?? node.Avatar ?? node) as Record<string, unknown>
  const avatarId = readString(avatar, "id", "Id", "avatarId", "AvatarId")
  const avatarName =
    readString(avatar, "username", "Username", "name", "Name", "fullName", "FullName") ||
    readString(node, "username", "Username")
  const avatarEmail = readString(avatar, "email", "Email") || readString(node, "email", "Email")
  const level = readString(avatar, "level", "Level") || "0"

  if (!jwt) return null

  session.persistAuth({
    jwt,
    avatarId,
    displayName: avatarName,
    email: avatarEmail,
  })

  return { jwt, avatarId, avatarName, avatarEmail, level }
}

export function createAuthApi(http: HttpClient, session: SessionApi) {
  return {
    async authenticate(creds: {
      username?: string
      email?: string
      password: string
    }): Promise<{ ok: true; result: AuthResult } | { ok: false; message: string }> {
      const username = (creds.username ?? creds.email ?? "").trim()
      const password = creds.password ?? ""
      if (!username || !password) {
        return { ok: false, message: "Username and password are required" }
      }
      // ONODE AuthenticateRequest is PascalCase; STJ on Railway is case-sensitive.
      const body = {
        Username: username,
        Password: password,
      }
      const { status, text, json } = await requestJson(
        http,
        oasisUrl(http, "/api/avatar/authenticate"),
        { method: "POST", body: JSON.stringify(body), auth: false },
      )
      const mapped = mapAuthPayload(json, session)
      if (!mapped) {
        const err = isErrorBody(json)
        return {
          ok: false,
          message: err.message || text || `HTTP ${status}`,
        }
      }
      return { ok: true, result: mapped }
    },

    async authenticateGoogle(idToken: string): Promise<
      { ok: true; result: AuthResult } | { ok: false; message: string }
    > {
      const { status, text, json } = await requestJson(
        http,
        oasisUrl(http, "/api/avatar/auth/google"),
        {
          method: "POST",
          body: JSON.stringify({ idToken }),
          auth: false,
        },
      )
      const mapped = mapAuthPayload(json, session)
      if (!mapped) {
        const err = isErrorBody(json)
        return {
          ok: false,
          message: err.message || text || `HTTP ${status}`,
        }
      }
      return { ok: true, result: mapped }
    },

    async getLoggedInAvatar(): Promise<unknown | null> {
      if (!session.hasJwt()) return null
      const { status, json } = await requestJson(
        http,
        oasisUrl(http, "/api/avatar/get-logged-in-avatar"),
      )
      if (status < 200 || status >= 300) return null
      if (isErrorBody(json).isError) return null
      return unwrapResult(json)
    },
  }
}

export type AuthApi = ReturnType<typeof createAuthApi>
