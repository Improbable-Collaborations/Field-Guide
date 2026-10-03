import type { FieldGuideWeb4ClientConfig } from "./config.js"
import type { GeoApi } from "./geo.js"
import type { HttpClient } from "./http.js"
import {
  isErrorBody,
  oasisUrl,
  readString,
  requestJson,
  unwrapResult,
} from "./http.js"
import type { SessionApi } from "./session.js"
import type { DropResult, DropSpec } from "./types.js"
import { ensureSolanaWallet } from "./wallet.js"

function shortReason(message: string, fallback: string): string {
  const src = (message || fallback || "Mint failed").trim()
  const idx = src.toLowerCase().indexOf("reason:")
  let out = idx >= 0 ? src.slice(idx + 7).trim() : src
  if (out.length > 90) out = out.slice(0, 90) + "…"
  return out || "Mint failed"
}

export function createDropsApi(
  http: HttpClient,
  session: SessionApi,
  config: FieldGuideWeb4ClientConfig,
  geo: GeoApi,
) {
  async function resolveReceiveWallet(): Promise<{ address: string; message: string }> {
    const result = await ensureSolanaWallet(http, session)
    return { address: result.address, message: result.message }
  }

  async function mintAndPlace(
    spec: DropSpec & { latitude: number; longitude: number },
    wallet: string,
  ): Promise<{
    ok: boolean
    web4Id: string
    tokenAddress: string
    mintHash: string
    message: string
  }> {
    const avatarId = session.get().avatarId
    const latMicro = Math.round(spec.latitude * 1_000_000)
    const lonMicro = Math.round(spec.longitude * 1_000_000)
    const cluster = config.solanaCluster ?? "devnet"
    const image = (spec.imageUrl || config.dropNftImageUrl || "").trim()
    if (!image) {
      return {
        ok: false,
        web4Id: "",
        tokenAddress: "",
        mintHash: "",
        message: "Drop image URL is missing",
      }
    }

    const kind = (spec.kind || "drop").trim()
    const title = (spec.name || "Field Drop").trim()
    let desc = spec.description ?? "Shared world drop from Field Guide"
    if (spec.fileUrl) desc = `${desc}\nGuide: ${spec.fileUrl}`.trim()
    const symbol = kind.toLowerCase() === "guide" ? "GUIDE" : "DROP"

    const body: Record<string, unknown> = {
      Title: title,
      Description: desc,
      Symbol: symbol,
      NumberToMint: 1,
      Price: 0,
      OnChainProvider: "SolanaOASIS",
      OffChainProvider: "MongoDBOASIS",
      GeoNFTMetaDataProvider: "MongoDBOASIS",
      NFTOffChainMetaType: "OASIS",
      NFTStandardType: "SPL",
      StoreNFTMetaDataOnChain: false,
      WaitTillNFTMinted: true,
      WaitForNFTToMintInSeconds: 120,
      AttemptToMintEveryXSeconds: 2,
      WaitTillNFTSent: true,
      WaitForNFTToSendInSeconds: 120,
      AttemptToSendEveryXSeconds: 2,
      Cluster: cluster,
      Lat: latMicro,
      Long: lonMicro,
      AllowOtherPlayersToAlsoCollect: true,
      PermSpawn: false,
      GlobalSpawnQuantity: 1,
      PlayerSpawnQuantity: 1,
      RespawnDurationInSeconds: 0,
      SendToAddressAfterMinting: wallet,
      ImageUrl: image,
      ThumbnailUrl: image,
      MetaData: {
        kind,
        imageUrl: image,
        ...(spec.fileUrl ? { fileUrl: spec.fileUrl.trim() } : {}),
      },
    }
    if (avatarId) body.SendToAvatarAfterMintingId = avatarId

    const headers: Record<string, string> = {
      "X-Solana-Cluster": cluster,
    }

    const { status, json, text } = await requestJson(
      http,
      oasisUrl(http, "/api/nft/mint-and-place-geo-nft"),
      {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      },
    )

    const err = isErrorBody(json)
    if (status < 200 || status >= 300 || err.isError) {
      return {
        ok: false,
        web4Id: "",
        tokenAddress: "",
        mintHash: "",
        message: shortReason(err.message || text, `HTTP ${status}`),
      }
    }

    const node = unwrapResult(json) as Record<string, unknown> | null
    const id = readString(node, "id", "Id")
    let token = ""
    let hash = ""
    const web3 =
      node?.web3NFTs
      ?? node?.Web3NFTs
      ?? node?.newlyMintedWeb3NFTs
      ?? node?.NewlyMintedWeb3NFTs
    if (Array.isArray(web3) && web3.length > 0) {
      token = readString(web3[0], "nftTokenAddress", "NFTTokenAddress")
      hash = readString(web3[0], "mintTransactionHash", "MintTransactionHash")
    }
    if (!token) token = readString(node, "nftTokenAddress", "NFTTokenAddress")
    if (!hash) hash = readString(node, "mintTransactionHash", "MintTransactionHash")

    if (!hash && !token) {
      return {
        ok: false,
        web4Id: id,
        tokenAddress: "",
        mintHash: "",
        message: "Mint returned no Solana transaction. Drop was not placed on-chain.",
      }
    }

    return {
      ok: true,
      web4Id: id,
      tokenAddress: token,
      mintHash: hash,
      message: readString(json, "message", "Message"),
    }
  }

  return {
    async dropAt(
      spec: DropSpec & { latitude: number; longitude: number },
      onStatus?: (msg: string) => void,
    ): Promise<DropResult> {
      const done: DropResult = {
        ok: false,
        starPinId: "",
        web4Id: "",
        tokenAddress: "",
        mintHash: "",
        walletAddress: "",
        message: "",
      }

      if (config.allowInGameDrop === false) {
        done.message = "In-game drop disabled (allowInGameDrop)"
        return done
      }
      if (!session.hasJwt()) {
        done.message = "Sign in required to mint a shared drop"
        return done
      }
      if (!Number.isFinite(spec.latitude) || !Number.isFinite(spec.longitude)) {
        done.message = "latitude and longitude required"
        return done
      }

      onStatus?.("Looking up your Solana wallet")
      const resolved = await resolveReceiveWallet()
      if (!resolved.address) {
        done.message = resolved.message || "Could not create or find a Solana wallet"
        return done
      }
      done.walletAddress = resolved.address
      onStatus?.(`Wallet ${resolved.address.slice(0, 4)}…${resolved.address.slice(-4)}`)

      onStatus?.("Minting SPL token on Solana. This can take a minute.")
      const minted = await mintAndPlace(spec, resolved.address)
      done.web4Id = minted.web4Id
      done.tokenAddress = minted.tokenAddress
      done.mintHash = minted.mintHash
      done.message = minted.message
      if (!minted.ok) return done

      onStatus?.("Mint landed. Pinning to STAR so others can find it.")
      const pinId =
        (spec.trailPinId || "").trim()
        || `drop-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`
      const isGuide = (spec.kind || "").toLowerCase() === "guide"
      const title = (spec.name || "Field Drop").trim()
      const image = (spec.imageUrl || config.dropNftImageUrl || "").trim()
      const state = session.get()

      const pin = await geo.placePin({
        name: title,
        description: spec.description ?? "Shared world drop from Field Guide",
        latitude: spec.latitude,
        longitude: spec.longitude,
        radiusM: 75,
        trailPinId: pinId,
        trail: "star-drop",
        questRole: "drop",
        web4NftId: done.web4Id,
        source: config.source || "field-guide-web",
        imageUrl: image,
        fileUrl: spec.fileUrl ?? "",
        kind: isGuide ? "guide" : "drop",
        narrationText: spec.description ?? "",
        markerStyle: isGuide ? "discover-library" : "discover-attraction",
        createdByAvatarName: state.avatarName,
        createdByAvatarId: state.avatarId,
      })

      if (!pin.ok) {
        done.ok = false
        done.message = `Minted on Solana, but STAR pin failed: ${pin.message}`
        return done
      }

      done.starPinId = pin.id || pinId
      done.ok = true
      return done
    },

    /**
     * Mint a street collectible into the avatar Solana wallet.
     * Does not place a new GeoNFT: the pin already exists on the authored trail.
     */
    async mintCollectibleToWallet(pin: {
      id: string
      title: string
      notes?: string
      narrationText?: string
      lat: number
      lon: number
      imageUrl?: string
    }): Promise<DropResult> {
      const done: DropResult = {
        ok: false,
        starPinId: pin.id,
        web4Id: "",
        tokenAddress: "",
        mintHash: "",
        walletAddress: "",
        message: "",
      }

      if (!pin.id) {
        done.message = "Pin id required"
        return done
      }
      if (!session.hasJwt()) {
        done.message = "Sign in required to mint a glove"
        return done
      }

      const resolved = await resolveReceiveWallet()
      if (!resolved.address) {
        done.message = resolved.message || "Could not create or find a Solana wallet"
        return done
      }
      done.walletAddress = resolved.address

      const avatarId = session.get().avatarId
      const image = (pin.imageUrl || config.gloveNftImageUrl || config.dropNftImageUrl || "").trim()
      if (!image) {
        done.message = "Glove image URL is missing"
        return done
      }

      const title = (pin.title || pin.id).trim()
      const desc = [
        pin.narrationText || pin.notes || "JAB street glove",
        `trailPinId=${pin.id}`,
        Number.isFinite(pin.lat) ? `lat=${pin.lat}` : "",
        Number.isFinite(pin.lon) ? `lon=${pin.lon}` : "",
      ]
        .filter(Boolean)
        .join("\n")

      const body: Record<string, unknown> = {
        Title: title,
        Description: desc,
        Symbol: "GLOVE",
        NumberToMint: 1,
        Price: 0,
        OnChainProvider: "SolanaOASIS",
        OffChainProvider: "MongoDBOASIS",
        NFTOffChainMetaType: "OASIS",
        NFTStandardType: "SPL",
        StoreNFTMetaDataOnChain: false,
        WaitTillNFTMinted: true,
        WaitForNFTToMintInSeconds: 120,
        AttemptToMintEveryXSeconds: 2,
        WaitTillNFTSent: true,
        WaitForNFTToSendInSeconds: 120,
        AttemptToSendEveryXSeconds: 2,
        SendToAddressAfterMinting: resolved.address,
        ImageUrl: image,
        ThumbnailUrl: image,
        MemoText: pin.id,
        MetaData: {
          kind: "glove",
          trailPinId: pin.id,
          questRole: "glove",
        },
      }
      if (avatarId) body.SendToAvatarAfterMintingId = avatarId

      const { status, json, text } = await requestJson(
        http,
        oasisUrl(http, "/api/nft/mint-nft"),
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "X-Solana-Cluster": config.solanaCluster ?? "devnet" },
        },
      )

      const err = isErrorBody(json)
      if (status < 200 || status >= 300 || err.isError) {
        done.message = shortReason(err.message || text, `HTTP ${status}`)
        return done
      }

      const node = unwrapResult(json) as Record<string, unknown> | null
      done.web4Id = readString(node, "id", "Id")
      const web3 =
        node?.web3NFTs
        ?? node?.Web3NFTs
        ?? node?.newlyMintedWeb3NFTs
        ?? node?.NewlyMintedWeb3NFTs
      if (Array.isArray(web3) && web3.length > 0) {
        done.tokenAddress = readString(web3[0], "nftTokenAddress", "NFTTokenAddress")
        done.mintHash = readString(web3[0], "mintTransactionHash", "MintTransactionHash")
      }
      if (!done.tokenAddress) done.tokenAddress = readString(node, "nftTokenAddress", "NFTTokenAddress")
      if (!done.mintHash) done.mintHash = readString(node, "mintTransactionHash", "MintTransactionHash")

      if (!done.mintHash && !done.tokenAddress) {
        done.message = "Mint returned no Solana transaction. Glove is not in the wallet."
        return done
      }

      done.ok = true
      done.message = readString(json, "message", "Message") || "Glove minted to wallet"
      return done
    },
  }
}

export type DropsApi = ReturnType<typeof createDropsApi>
