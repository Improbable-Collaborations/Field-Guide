import { describe, expect, it } from "vitest"
import {
  createFieldGuideWeb4Client,
  OASIS_NATIVE_TOKENS_NOTE,
  parseOasisNftList,
  pickSolanaWalletRecord,
} from "field-guide-web4-client"
import { loadAuthoredTrailPins } from "./loadTrailPins"
import { memoryStorage } from "./memoryStorage"
import { PLACES } from "../places"
import { buildProfileSnapshot } from "../profile/model"
import {
  fieldGuideWalletChatText,
  mapFieldGuideWallet,
  mintedGlovePinIdsFromNfts,
} from "./walletTool"

const ADDR = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
const AVATAR = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const WALLET_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"

function testJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({
      avatarId: AVATAR,
      unique_name: "Max",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url")
  return `eyJhbGciOiJub25lIn0.${payload}.sig`
}

function oasisJson(result: unknown, extra: Record<string, unknown> = {}) {
  return { isError: false, result, ...extra }
}

describe("field_guide_wallet mapper", () => {
  it("maps OASIS NFT JSON onto structuredContent without dumping the full address in chat text", () => {
    const nfts = parseOasisNftList({
      isError: false,
      result: [
        {
          Id: "nft-web4-1",
          Title: "Club door mitt",
          Symbol: "GLOVE",
          NFTTokenAddress: "GloveMint11111111111111111111111111111111111",
          MintTransactionHash: "5MintHashExample111111111111111111111111111111111111111111",
          MetaData: { trailPinId: "glove-victoria-door" },
        },
      ],
    })
    expect(nfts[0]?.trailPinId).toBe("glove-victoria-door")
    expect(mintedGlovePinIdsFromNfts(nfts)).toEqual(["glove-victoria-door"])

    const snap = buildProfileSnapshot({
      signedIn: true,
      avatarName: "Max",
      avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      avatarEmail: "max@example.com",
      wallet: ADDR,
      persona: null,
      clusterId: null,
      places: PLACES,
      trailPins: loadAuthoredTrailPins(PLACES),
      checkedInIds: ["hitchhiker-stoop", "glove-victoria-door"],
      mintedIds: ["glove-victoria-door"],
    })
    expect(snap.experiences.find((e) => e.pinId === "hitchhiker-stoop")?.minted).toBe(false)
    expect(snap.experiences.find((e) => e.pinId === "hitchhiker-stoop")?.kind).toBe("check-in")

    const content = mapFieldGuideWallet({
      read: {
        expired: false,
        isError: false,
        message: "",
        avatarId: snap.avatarId,
        avatarName: snap.avatarName,
        address: ADDR,
        walletId: "wallet-1",
        nativeBalance: 0.5,
        nativeSymbol: "SOLANA",
        tokensNote: OASIS_NATIVE_TOKENS_NOTE,
        nfts,
        nftError: "",
      },
      cluster: "devnet",
      snap,
      includeFieldGuide: true,
      includeNfts: true,
    })
    expect(content.address).toBe(ADDR)
    expect(content.addressMasked).toMatch(/7xKX/)
    expect(content.addressMasked).not.toBe(ADDR)
    expect(content.fieldGuide?.collectedPinIds).toContain("hitchhiker-stoop")
    expect(content.fieldGuide?.collectedPinIds).toContain("glove-victoria-door")
    expect(content.fieldGuide?.mintedGlovePinIds).toEqual(["glove-victoria-door"])
    const stoop = content.fieldGuide?.experiences.find((e) => e.pinId === "hitchhiker-stoop")
    expect(stoop).toEqual({
      pinId: "hitchhiker-stoop",
      kind: "check-in",
      minted: false,
      starCompleted: true,
    })
    const glove = content.fieldGuide?.experiences.find((e) => e.pinId === "glove-victoria-door")
    expect(glove?.minted).toBe(true)
    expect(glove?.starCompleted).toBe(true)
    const text = fieldGuideWalletChatText(content)
    expect(text).toContain(content.addressMasked)
    expect(text).not.toContain(ADDR)
    expect(JSON.stringify(content)).not.toMatch(/privateKey|PrivateKey|secretRecoveryPhrase/i)
  })

  it("does not mark STAR-only collects as minted when OASIS returned no NFT", () => {
    const snap = buildProfileSnapshot({
      signedIn: true,
      avatarName: "Max",
      avatarId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      avatarEmail: "max@example.com",
      wallet: ADDR,
      persona: null,
      clusterId: null,
      places: PLACES,
      trailPins: loadAuthoredTrailPins(PLACES),
      checkedInIds: ["glove-victoria-door", "hitchhiker-stoop"],
      mintedIds: ["glove-victoria-door"],
    })
    const content = mapFieldGuideWallet({
      read: {
        expired: false,
        isError: false,
        message: "",
        avatarId: snap.avatarId,
        avatarName: "Max",
        address: ADDR,
        walletId: "wallet-1",
        nativeBalance: 0,
        nativeSymbol: "SOLANA",
        tokensNote: OASIS_NATIVE_TOKENS_NOTE,
        nfts: [],
        nftError: "NFT load lagged",
      },
      cluster: "devnet",
      snap,
      includeFieldGuide: true,
      includeNfts: true,
    })
    expect(content.fieldGuide?.mintedGlovePinIds).toEqual([])
    expect(content.fieldGuide?.experiences.find((e) => e.pinId === "glove-victoria-door")?.minted).toBe(
      false,
    )
    expect(content.message).toMatch(/lagged/)
  })

  it("picks wallet id from the numeric Solana bucket without private keys", () => {
    const rec = pickSolanaWalletRecord({
      "3": [
        {
          WalletId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          WalletAddress: ADDR,
          IsDefaultWallet: true,
          Balance: 1.25,
          PrivateKey: "do-not-copy",
        },
      ],
    })
    expect(rec).toEqual({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      address: ADDR,
      balance: 1.25,
    })
  })

  it("reads avatar wallet, native tokens, and NFTs over OASIS HTTP", async () => {
    const jwt = testJwt()
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes("/api/avatar/get-logged-in-avatar")) {
        return new Response(
          JSON.stringify(
            oasisJson({
              id: AVATAR,
              username: "Max",
              providerWallets: { "3": [{ WalletAddress: ADDR, IsDefaultWallet: true }] },
            }),
          ),
          { status: 200 },
        )
      }
      if (url.includes("/wallets/false/false")) {
        return new Response(
          JSON.stringify(
            oasisJson({
              SolanaOASIS: [
                { WalletId: WALLET_ID, WalletAddress: ADDR, IsDefaultWallet: true, Balance: 0.5 },
              ],
            }),
          ),
          { status: 200 },
        )
      }
      if (url.includes("/default-wallet")) {
        return new Response(
          JSON.stringify(
            oasisJson({ WalletId: WALLET_ID, WalletAddress: ADDR, IsDefaultWallet: true, Balance: 0.5 }),
          ),
          { status: 200 },
        )
      }
      if (url.includes("/tokens")) {
        return new Response(
          JSON.stringify(
            oasisJson([{ symbol: "SOLANA", balance: 0.5, isNative: true }]),
          ),
          { status: 200 },
        )
      }
      if (url.includes("load-all-nfts-for_avatar")) {
        return new Response(
          JSON.stringify(
            oasisJson([
              {
                Id: "nft-1",
                Title: "Club door mitt",
                Symbol: "GLOVE",
                MetaData: { trailPinId: "glove-victoria-door" },
              },
            ]),
          ),
          { status: 200 },
        )
      }
      if (url.includes("load-all-web3-nfts-for-avatar")) {
        return new Response(JSON.stringify(oasisJson([])), { status: 200 })
      }
      return new Response(JSON.stringify({ isError: true, message: `unexpected ${url}` }), { status: 500 })
    }
    const client = createFieldGuideWeb4Client({
      storage: memoryStorage({ "fg-web4.jwt": jwt }),
      fetch: fetchImpl,
      listCacheTtlSeconds: 0,
      source: "field-guide-mcp",
    })
    const read = await client.wallet.read()
    expect(read.expired).toBe(false)
    expect(read.isError).toBe(false)
    expect(read.address).toBe(ADDR)
    expect(read.nativeBalance).toBe(0.5)
    expect(read.nativeSymbol).toBe("SOLANA")
    expect(read.nfts[0]?.trailPinId).toBe("glove-victoria-door")
    expect(read.nfts[0]?.symbol).toBe("GLOVE")
  })

  it("returns the collect expired-session message on 401", async () => {
    const jwt = testJwt()
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ isError: true, message: "Unauthorized" }), { status: 401 })
    const client = createFieldGuideWeb4Client({
      storage: memoryStorage({ "fg-web4.jwt": jwt }),
      fetch: fetchImpl,
      listCacheTtlSeconds: 0,
      source: "field-guide-mcp",
    })
    const read = await client.wallet.read()
    expect(read.expired).toBe(true)
    expect(read.isError).toBe(true)
    expect(read.message).toBe("OASIS session expired. Sign in to Field Guide MCP again.")
    expect(read.address).toBeNull()
  })
})
