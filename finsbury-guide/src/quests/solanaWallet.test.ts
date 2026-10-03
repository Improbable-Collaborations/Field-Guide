import { describe, expect, it } from "vitest"
import { isUsableSolanaAddress, pickSolanaFromProviderWallets } from "field-guide-web4-client"

const ADDR = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"

describe("OASIS Solana wallet lookup", () => {
  it("reads the BSON numeric SolanaOASIS bucket as an array", () => {
    expect(
      pickSolanaFromProviderWallets({
        "3": [{ WalletAddress: ADDR, IsDefaultWallet: true }],
      }),
    ).toBe(ADDR)
  })

  it("rejects EVM-shaped keys", () => {
    expect(isUsableSolanaAddress("0x" + "a".repeat(40))).toBe(false)
    expect(isUsableSolanaAddress(ADDR)).toBe(true)
  })
})
