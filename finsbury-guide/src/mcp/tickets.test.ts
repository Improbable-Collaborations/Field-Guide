import { describe, expect, it } from "vitest"
import { issueConnectTicket, jwtForTicket, putSiteView, siteViewForTicket } from "./tickets"

describe("connect tickets", () => {
  it("stores live tab presence for the same JWT", () => {
    const jwt = "header.payload.sig"
    const ticket = issueConnectTicket(jwt)
    expect(jwtForTicket(ticket)).toBe(jwt)
    const put = putSiteView(ticket, jwt, { mode: "map", selectedPlaceId: "trail-jab-sw1-gloves" })
    expect(put.ok).toBe(true)
    expect(siteViewForTicket(ticket)?.selectedPlaceId).toBe("trail-jab-sw1-gloves")
    const denied = putSiteView(ticket, "other.jwt", { mode: "you" })
    expect(denied.ok).toBe(false)
  })
})
