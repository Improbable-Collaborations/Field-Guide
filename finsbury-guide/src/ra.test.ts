import { describe, expect, it } from "vitest"
import { calendarDate, listingDateWindow } from "./ra"

describe("RA listing window", () => {
  it("uses London's calendar, not UTC, for listingDate", () => {
    const justAfterUtcMidnight = new Date("2026-10-03T23:30:00.000Z")
    expect(calendarDate(justAfterUtcMidnight, "UTC")).toBe("2026-10-03")
    expect(calendarDate(justAfterUtcMidnight, "Europe/London")).toBe("2026-10-04")
    expect(listingDateWindow(justAfterUtcMidnight)).toEqual({
      gte: "2026-10-04",
      lte: "2026-10-14",
    })
  })

  it("keeps a 10-day window from a London afternoon", () => {
    const londonAfternoon = new Date("2026-10-03T15:00:00.000+01:00")
    expect(listingDateWindow(londonAfternoon)).toEqual({
      gte: "2026-10-03",
      lte: "2026-10-13",
    })
  })
})
