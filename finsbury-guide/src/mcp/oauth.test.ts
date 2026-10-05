import { describe, expect, it } from "vitest"
import { avatarIdFromJwt } from "./jwtAvatar"
import {
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  oasisJwtForAccessToken,
  pkceS256,
  protectedResourceMetadata,
  registerClient,
} from "./oauth"
import { putSiteViewForJwt, siteViewForJwt, enqueueSiteCommandForJwt, takeSiteCommandForJwt } from "./presence"

function jwtForAvatar(avatarId: string): string {
  const payload = Buffer.from(JSON.stringify({ nameid: avatarId }), "utf8").toString("base64url")
  return `eyJhbGciOiJub25lIn0.${payload}.sig`
}

describe("Field Guide OAuth MCP", () => {
  it("points protected-resource metadata at one /mcp URL", () => {
    const meta = protectedResourceMetadata("https://guide.example")
    expect(meta.resource).toBe("https://guide.example/mcp")
    expect(meta.authorization_servers).toEqual(["https://guide.example"])
    expect(protectedResourceMetadata("https://guide.example", "/mcp/map-ui").resource).toBe(
      "https://guide.example/mcp/map-ui",
    )
  })

  it("exchanges a PKCE code for an access token bound to the OASIS JWT", () => {
    const jwt = jwtForAvatar("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    const verifier = "a".repeat(43)
    const registered = registerClient({
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/connector/oauth/callback"],
    })
    const code = issueAuthorizationCode({
      clientId: registered.client_id,
      redirectUri: "https://chatgpt.com/connector/oauth/callback",
      challenge: pkceS256(verifier),
      jwt,
      resource: "https://guide.example/mcp",
    })
    const tokens = exchangeAuthorizationCode({
      code,
      clientId: registered.client_id,
      redirectUri: "https://chatgpt.com/connector/oauth/callback",
      codeVerifier: verifier,
    })
    expect(tokens.access_token.startsWith("fgat_")).toBe(true)
    expect(oasisJwtForAccessToken(tokens.access_token)).toBe(jwt)
  })

  it("stores live tab presence on the avatar, not on a ticket URL", () => {
    const jwt = jwtForAvatar("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")
    expect(avatarIdFromJwt(jwt)).toBe("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")
    const put = putSiteViewForJwt(jwt, { mode: "map", selectedPlaceId: "trail-jab-sw1-gloves" })
    expect(put.ok).toBe(true)
    expect(siteViewForJwt(jwt)?.selectedPlaceId).toBe("trail-jab-sw1-gloves")
  })

  it("queues open-look only while the Field Guide tab is live", () => {
    const jwt = jwtForAvatar("cccccccc-dddd-eeee-ffff-000000000000")
    expect(enqueueSiteCommandForJwt(jwt, { type: "open-look", placeId: "trail-finsbury-park-circuit" }).ok).toBe(
      false,
    )
    expect(putSiteViewForJwt(jwt, { mode: "map", selectedPlaceId: "trail-finsbury-park-circuit" }).ok).toBe(true)
    const queued = enqueueSiteCommandForJwt(jwt, {
      type: "open-look",
      placeId: "trail-finsbury-park-circuit",
      pinId: "park-manor-house-gate",
    })
    expect(queued).toMatchObject({
      ok: true,
      command: { type: "open-look", pinId: "park-manor-house-gate" },
    })
    expect(takeSiteCommandForJwt(jwt)?.pinId).toBe("park-manor-house-gate")
    expect(takeSiteCommandForJwt(jwt)).toBeNull()
  })
})
