/** Venue markers from playa-map.html (GPS-calibrated). */
export type PlaceType =
  | "anchor"
  | "conservation"
  | "hotel_champion"
  | "hotel_partner"
  | "hotel_starter"
  | "gym"
  | string

export type Place = {
  id: string
  name: string
  shortName: string
  type: PlaceType
  starHolonId?: string
  coords: [number, number] // [lng, lat]
  subtitle?: string
  region?: string
  sector?: string
  desc?: string
  localStats?: Record<string, number | string>
  link?: string
  googleMaps?: string
  [key: string]: unknown
}

export const PLACES: Place[] = [
  {
    "id": "pdc",
    "name": "Playa del Carmen",
    "shortName": "PDC",
    "type": "anchor",
    "starHolonId": "99a83ee0-2d60-400a-9aab-18e33460f554",
    "coords": [
      -87.079,
      20.622
    ],
    "subtitle": "Quintana Roo · Mexico · OASIS Registered Region",
    "region": "Riviera Maya",
    "sector": "Playa del Carmen Centro",
    "desc": "Playa del Carmen — gateway to the Riviera Maya and host city for the Pulmón Verde conservation-hospitality ecosystem. This ground view maps all hotel and conservation partners at their real GPS coordinates.",
    "localStats": {
      "karma": 145800,
      "avatars": 892,
      "hotels": 24,
      "trees": 847
    }
  },
  {
    "id": "pv",
    "name": "Pulmón Verde",
    "shortName": "PULMÓN VERDE",
    "type": "conservation",
    "starHolonId": "940abe47-0744-4663-a7d2-fb3d2a9f3352",
    "coords": [
      -87.058506,
      20.642099
    ],
    "subtitle": "Conservation Area · 4.5 ha · Last Coastal Jungle · OASIS STAR OAPP",
    "region": "Playa del Carmen Norte",
    "sector": "Federal Maritime Zone · PDC Beach Norte",
    "desc": "4.5 hectares of lowland tropical forest between Hotel Coco Beach and Beach 88 Norte. The last coastal jungle of Playa del Carmen. Every registered tree is a GeoSpatialNFT. Every guide session is transcribed into the living forest record.",
    "localStats": {
      "trees": 847,
      "species": 94,
      "co2": 312,
      "hours": 2840,
      "karma": 45200,
      "visitors": 412
    },
    "link": "http://localhost:5173/book",
    "features": "STAR OAPP,GeoSpatialNFT,Chapter System,Conversation Capture,Carbon Credits,PGT Timebank,Conservation Passport,PrivacyMage Trust Graph"
  },
  {
    "id": "thompson",
    "name": "Hyatt Centric Playa del Carmen",
    "shortName": "Hyatt Centric",
    "type": "hotel_champion",
    "starHolonId": "3479be5b-d8b1-41b5-9a7d-a1f380412717",
    "coords": [
      -87.064,
      20.633
    ],
    "subtitle": "PDC Centro Beach · Champion · Rank #1",
    "region": "Playa del Carmen Centro",
    "sector": "Calle 8 Norte · Beachfront",
    "desc": "Rebranded from Thompson Beach House in 2025. Two concepts: Downtown House (92 adults-only rooms on 5th Avenue) and Beach House (27 family suites beachfront). Mid-century modern decor, UMI rooftop dining, Alessia Dayclub. Rank #1. 87 guests sent, 12 trees sponsored.",
    "gm": {
      "name": "Ankara Angulo",
      "title": "General Manager"
    },
    "googleMaps": "https://maps.google.com/?q=Hyatt+Centric+Playa+del+Carmen",
    "localStats": {
      "karma": 18450,
      "avatars": 87,
      "trees": 12,
      "co2": 6.2,
      "rank": 1,
      "tier": "Champion"
    },
    "link": "http://localhost:5173/hotel"
  },
  {
    "id": "elements",
    "name": "The Elements",
    "shortName": "Elements",
    "type": "hotel_champion",
    "starHolonId": "ce95d977-9c7e-45bc-b7e3-375695c117eb",
    "coords": [
      -87.061,
      20.636
    ],
    "subtitle": "Las Brisas · Champion · Pulmón Verde Neighbour",
    "region": "Playa del Carmen Norte",
    "sector": "Av. Flamingo · Calle 46 · Las Brisas",
    "desc": "PDC's only private beach resort, at Av. Flamingo & Calle 46 — directly adjacent to Pulmón Verde. 70 oceanfront condo suites (1-3 bed) with fully-equipped kitchens and ocean views. Private beach club 10am–6pm. One of Playa's largest pools. Booking.com 8.8 \"Excellent\" from 990+ reviews. Strategically the most important Pulmón Verde partner — guests wake up next door.",
    "gm": {
      "name": "TBC",
      "title": "Hotel Manager"
    },
    "googleMaps": "https://maps.google.com/?q=The+Elements+Playa+del+Carmen+Calle+46",
    "localStats": {
      "karma": 0,
      "avatars": 0,
      "trees": 0,
      "co2": 0,
      "rank": 0,
      "tier": "Champion · Prospective"
    },
    "link": "http://localhost:5173/hotel",
    "pvNeighbour": true
  },
  {
    "id": "grandhyatt",
    "name": "Grand Hyatt PDC",
    "shortName": "Grand Hyatt",
    "type": "hotel_champion",
    "starHolonId": "cf000214-5f26-472e-b070-68593680ebf5",
    "coords": [
      -87.068,
      20.632
    ],
    "subtitle": "Playa del Carmen · Champion · Rank #3",
    "region": "Playa del Carmen",
    "sector": "1a Avenida · Calle 26",
    "desc": "Grand Hyatt Playa del Carmen Resort at 1a Avenida & Calle 26, designed by Sordo Madaleno. 54 guests sent, 4 trees sponsored. First hotel to implement the concierge QR code booking flow.",
    "gm": {
      "name": "Paul Wood",
      "title": "General Manager"
    },
    "googleMaps": "https://maps.google.com/?q=Grand+Hyatt+Playa+del+Carmen",
    "localStats": {
      "karma": 12840,
      "avatars": 54,
      "trees": 4,
      "co2": 2.1,
      "rank": 3,
      "tier": "Champion"
    },
    "link": "http://localhost:5173/hotel"
  },
  {
    "id": "viceroy",
    "name": "Viceroy Riviera Maya",
    "shortName": "Viceroy",
    "type": "hotel_champion",
    "starHolonId": "1fe1a430-aec8-45dd-a4a3-d4fc5eb2fe89",
    "coords": [
      -87.033,
      20.665
    ],
    "subtitle": "Xcalacoco · Champion · Rank #2",
    "region": "Riviera Maya Norte",
    "sector": "Playa Xcalacoco · 10km North of PDC",
    "desc": "Five-star adults-only villa resort at Playa Xcalacoco, 10km north of PDC. GPS-confirmed at 20.665°N, -87.033°W. Rank #2. 62 guests sent, 8 trees sponsored. Closest gap to the #1 position in the network.",
    "gm": {
      "name": "TBC",
      "title": "General Manager"
    },
    "googleMaps": "https://maps.google.com/?q=Viceroy+Riviera+Maya+Xcalacoco",
    "localStats": {
      "karma": 14200,
      "avatars": 62,
      "trees": 8,
      "co2": 3.9,
      "rank": 2,
      "tier": "Champion"
    },
    "link": "http://localhost:5173/hotel"
  },
  {
    "id": "fairmont",
    "name": "Fairmont Mayakoba",
    "shortName": "Fairmont",
    "type": "hotel_partner",
    "starHolonId": "c1273a1a-1314-4fa3-91c5-fa84ab456d3b",
    "coords": [
      -87.027,
      20.688
    ],
    "subtitle": "Mayakoba · Partner · Rank #8",
    "region": "Playa del Carmen Norte",
    "sector": "Mayakoba Lagoon · KM 298",
    "desc": "Family-friendly luxury in the 620-acre Mayakoba complex. Home to El Camaleón golf course (first PGA Tour venue in Latin America). 27 guests sent, 1 tree sponsored. Concierge actively recommends the Young Explorer quest.",
    "gm": {
      "name": "Jacco Van Teeffelen",
      "title": "General Manager · Best GM in Mexico 2023"
    },
    "googleMaps": "https://maps.google.com/?q=Fairmont+Mayakoba",
    "localStats": {
      "karma": 6200,
      "avatars": 27,
      "trees": 1,
      "co2": 0.6,
      "rank": 8,
      "tier": "Partner"
    }
  },
  {
    "id": "banyan",
    "name": "Banyan Tree Mayakoba",
    "shortName": "Banyan Tree",
    "type": "hotel_partner",
    "starHolonId": "4d302e5b-36e7-4545-9c58-fb429dbe1b1f",
    "coords": [
      -87.026,
      20.691
    ],
    "subtitle": "Mayakoba · Partner · Rank #7",
    "region": "Playa del Carmen Norte",
    "sector": "Mayakoba Lagoon",
    "desc": "Award-winning spa and wellness resort in the Mayakoba lagoon system. 31 guests sent, 2 trees sponsored. Wellness-oriented guests align naturally with the contemplative Chapter system.",
    "googleMaps": "https://maps.google.com/?q=Banyan+Tree+Mayakoba",
    "localStats": {
      "karma": 7400,
      "avatars": 31,
      "trees": 2,
      "co2": 0.9,
      "rank": 7,
      "tier": "Partner"
    }
  },
  {
    "id": "rosewood",
    "name": "Rosewood Mayakoba",
    "shortName": "Rosewood",
    "type": "hotel_partner",
    "starHolonId": "bed37419-7445-42a9-9bb6-e9706e95edb6",
    "coords": [
      -87.025,
      20.694
    ],
    "subtitle": "Mayakoba · Partner · Rank #6",
    "region": "Playa del Carmen Norte",
    "sector": "Mayakoba Lagoon",
    "desc": "Ultra-luxury resort built along winding lagoons and a mile-long white sand beach. 129 suites with plunge pools and butler service. Best Hotel in Mexico (US News 2025) · 2 Michelin Keys 2024. 36 guests sent, 2 trees sponsored.",
    "gm": {
      "name": "Edouard Grosmangin",
      "title": "Managing Director · Regional VP Mexico & South America"
    },
    "googleMaps": "https://maps.google.com/?q=Rosewood+Mayakoba",
    "localStats": {
      "karma": 8600,
      "avatars": 36,
      "trees": 2,
      "co2": 1,
      "rank": 6,
      "tier": "Partner"
    }
  },
  {
    "id": "xcaret",
    "name": "Xcaret Hotel",
    "shortName": "Xcaret",
    "type": "hotel_partner",
    "starHolonId": "924c6977-f1e9-4bbc-8458-a307f96ff072",
    "coords": [
      -87.11,
      20.578
    ],
    "subtitle": "Xcaret · Partner · Rank #5",
    "region": "Playa del Carmen Sur",
    "sector": "Xcaret Eco-Park · KM 282",
    "desc": "Part of the Xcaret eco-tourism empire. 41 guests sent, 3 trees sponsored. Natural partnership: guests primed for nature-based experiences.",
    "localStats": {
      "karma": 9800,
      "avatars": 41,
      "trees": 3,
      "co2": 1.4,
      "rank": 5,
      "tier": "Partner"
    }
  },
  {
    "id": "kore",
    "name": "Kore Tulum",
    "shortName": "Kore",
    "type": "hotel_partner",
    "starHolonId": "7f790e80-8fe0-4b02-b6f3-188619703c02",
    "coords": [
      -87.447,
      20.178
    ],
    "subtitle": "Tulum · Partner · Rank #4",
    "region": "Tulum",
    "sector": "Tulum Hotel Zone · Boca Paila KM 3.8",
    "desc": "Design-forward eco-resort in Tulum hotel zone (~65 km south). Rank #4. 48 guests sent, 6 trees sponsored. Highest trees-per-guest ratio in the network.",
    "localStats": {
      "karma": 11200,
      "avatars": 48,
      "trees": 6,
      "co2": 2.8,
      "rank": 4,
      "tier": "Partner"
    },
    "distant": true
  },
  {
    "id": "mamitas",
    "name": "Mamitas Beach Club",
    "shortName": "Mamitas",
    "type": "hotel_starter",
    "starHolonId": "8f5215e1-7756-422b-9417-96abf843efa1",
    "coords": [
      -87.064,
      20.644
    ],
    "subtitle": "Playa del Carmen · Starter",
    "region": "Playa del Carmen",
    "sector": "Calle 28 Norte · Beachfront",
    "desc": "Iconic beach club hotel at the heart of PDC's social scene. Starter tier. 8 guests sent. Leaderboard visibility beginning to drive competition.",
    "localStats": {
      "karma": 800,
      "avatars": 8,
      "trees": 0,
      "co2": 0,
      "rank": 24,
      "tier": "Starter"
    }
  },
  {
    "id": "hotelb",
    "name": "Hotel B Playa",
    "shortName": "Hotel B",
    "type": "hotel_starter",
    "starHolonId": "daf5680f-f7ee-4f3b-a112-3b725536b383",
    "coords": [
      -87.074,
      20.641
    ],
    "subtitle": "Playa del Carmen · Starter",
    "region": "Playa del Carmen",
    "sector": "5th Avenue Boutique Zone",
    "desc": "Boutique design hotel on 5th Avenue. Starter tier. 14 guests sent. QR code now in the welcome pack.",
    "localStats": {
      "karma": 1400,
      "avatars": 14,
      "trees": 0,
      "co2": 0,
      "rank": 18,
      "tier": "Starter"
    }
  },
  {
    "id": "aldea",
    "name": "Aldea Thai",
    "shortName": "Aldea Thai",
    "type": "hotel_starter",
    "starHolonId": "ee98985a-dd61-44b9-a703-ffbb2e80f921",
    "coords": [
      -87.067,
      20.632
    ],
    "subtitle": "PDC Centro · Starter",
    "region": "Playa del Carmen Centro",
    "sector": "Calle 28 Norte · 0.3mi from Mamita's",
    "desc": "Thai-inspired boutique hotel steps from Mamita's Beach Club at Calle 28 Norte, PDC centro. Confirmed GPS: 20.632°N, -87.067°W. Starter tier. 11 guests sent. Popular with European couples.",
    "googleMaps": "https://maps.google.com/?q=Aldea+Thai+Playa+del+Carmen",
    "localStats": {
      "karma": 1100,
      "avatars": 11,
      "trees": 0,
      "co2": 0,
      "rank": 21,
      "tier": "Starter"
    }
  },
  {
    "id": "union",
    "name": "The Union Muay Thai",
    "shortName": "The Union",
    "type": "gym",
    "starHolonId": "fc4847c5-af5c-4d6a-8e86-fa5e72f2a776",
    "coords": [
      -87.077,
      20.638
    ],
    "subtitle": "Av. 10 Norte · Calles 42–44 · Zazil-ha · PDC",
    "region": "Playa del Carmen",
    "sector": "Zazil-ha · Av. 10 Norte",
    "desc": "Old-school Muay Thai and boxing gym run by owner-instructor Big Mike, with nearly two decades of experience. Disciplines include Muay Thai, boxing, MMA and Jiu Jitsu. Day classes (6–10 people) and busy evening sessions (~18). Members have free gym access between classes. Gym mascot Pepe the dog presides over \"Pepe's Fighting Team.\"",
    "localStats": {
      "disciplines": 4,
      "classesPerDay": 6,
      "experience": 18,
      "members": 120
    },
    "link": "https://www.theunionmuaythaiboxing.com",
    "phone": "984-147-4454",
    "address": "Av. 10 Manzana 144 Lote 12, Zazil-ha, PDC",
    "tripadvisor": {
      "rank": 10,
      "total": 62,
      "reviewCount": 36,
      "rating": 5,
      "label": "Classes & Workshops · Playa del Carmen",
      "url": "https://www.tripadvisor.com/Attraction_Review-g150812-d10394285-Reviews-The_Union-Playa_del_Carmen_Yucatan_Peninsula.html"
    },
    "reviews": [
      {
        "author": "Visitor · Feb 2025",
        "stars": 5,
        "text": "Five ⭐'s!! Excellent prices, excellent. The place to be if you want to improve your body and mind."
      },
      {
        "author": "Visitor · Mar 2025",
        "stars": 5,
        "text": "Best Muay Thai gym in Playa. A Muay Thai sanctuary."
      },
      {
        "author": "Visitor · 2024",
        "stars": 5,
        "text": "Hands down THE BEST Muay Thai in Mexico. Big Mike is an incredible instructor — technique-focused, patient, and passionate about the sport."
      },
      {
        "author": "Visitor · 2023",
        "stars": 5,
        "text": "Came for one class, stayed for three weeks. The atmosphere is unbeatable. Pepe the dog greeted me at the door every morning."
      }
    ]
  },
  {
    "id": "riviera",
    "name": "Riviera Maya",
    "shortName": "Riviera Maya",
    "type": "anchor",
    "starHolonId": "0cef1ba2-bcbf-413d-a58d-5e3fe9d73752",
    "coords": [
      -87.02,
      20.752
    ],
    "subtitle": "Quintana Roo · Expansion Region",
    "region": "Riviera Maya",
    "sector": "Coastal Corridor",
    "desc": "130km coastal corridor from PDC to Tulum. Conservation sites at Puerto Morelos, Akumal, and the Tulum biosphere reserve are being evaluated as OASIS STAR OAPPs.",
    "localStats": {
      "sites": 1,
      "potential": 12,
      "hotelPartners": 24,
      "corridor": "130km"
    }
  }
] as Place[]
