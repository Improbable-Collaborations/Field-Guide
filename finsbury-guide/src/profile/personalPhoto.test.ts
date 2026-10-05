import { describe, expect, it } from "vitest"
import { PLACES } from "../places"
import { photoFromHolon, resolvePhotoLocation } from "./personalPhoto"

describe("personal Field Guide photos", () => {
  it("uses an authored pin's coordinates", () => {
    const loc = resolvePhotoLocation(
      { pinId: "glove-victoria-door" },
      PLACES,
      [{ id: "glove-victoria-door", lat: 51.49274, lon: -0.14726 } as never],
    )
    expect(loc.lon).toBeCloseTo(-0.14726, 4)
    expect(loc.lat).toBeCloseTo(51.49274, 4)
  })

  it("refuses a photo with no location", () => {
    expect(() => resolvePhotoLocation({ caption: "hi" } as never, PLACES, [])).toThrow(/longitude and latitude/)
  })

  it("reads a personal photo holon", () => {
    const photo = photoFromHolon({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      name: "Colonnade",
      metaData: {
        kind: "field-guide-personal-photo",
        imageUrl: "https://example.com/p.jpg",
        lon: -0.14,
        lat: 51.49,
        caption: "Mitt light",
      },
    })
    expect(photo?.imageUrl).toBe("https://example.com/p.jpg")
    expect(photo?.lon).toBeCloseTo(-0.14)
  })
})
