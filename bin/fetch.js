#!/usr/bin/env node
"use strict"

const https = require("https")
const { URL } = require("url")

const MAX_BYTES = 2097152
const TIMEOUT_MS = 10000
const DEX_HOST = "api.dexscreener.com"
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const WPLS = "0xa1077a294dde1b09bb078844df40758a5d0f9a27"
const DAI = "0xefd766ccb38eaf1dfd701853bfce31359239f305"
const EUSDC = "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07"
const EUSDT = "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f"
const HEX = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39"
const PLSX = "0x95b303987a60c71504d99aa1b13b4da07b0790ab"

const RAIL_RANK = {}
RAIL_RANK[DAI] = 8
RAIL_RANK[EUSDC] = 8
RAIL_RANK[EUSDT] = 8
RAIL_RANK[WPLS] = 6
RAIL_RANK[PLSX] = 4
RAIL_RANK[HEX] = 3

function fail(message, code) {
  process.stderr.write(String(message || "fetch failed") + "\n")
  process.exit(code || 1)
}

function isAllowedUrl(urlString) {
  try {
    const parsed = new URL(urlString)
    return parsed.protocol === "https:" && parsed.hostname === DEX_HOST
  } catch (err) {
    return false
  }
}

function getJson(urlString) {
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(urlString)
    } catch (err) {
      reject(new Error("Bad URL"))
      return
    }
    if (!isAllowedUrl(urlString)) {
      reject(new Error("Blocked host"))
      return
    }
    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "io.github.davidfeder.pulsewatch" }
      },
      (res) => {
        const chunks = []
        let size = 0
        res.on("data", (chunk) => {
          size += chunk.length
          if (size > MAX_BYTES) {
            req.destroy()
            reject(Object.assign(new Error("Response too large"), { code: 63 }))
            return
          }
          chunks.push(chunk)
        })
        res.on("end", () => {
          if (res.statusCode === 429) {
            reject(Object.assign(new Error("Rate limited"), { code: 22 }))
            return
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error("Network error"))
            return
          }
          const body = Buffer.concat(chunks).toString("utf8")
          try {
            resolve(JSON.parse(body))
          } catch (err) {
            reject(new Error("Bad response"))
          }
        })
      }
    )
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy()
      reject(Object.assign(new Error("Timed out"), { code: 28 }))
    })
    req.on("error", () => reject(Object.assign(new Error("Offline"), { code: 7 })))
    req.end()
  })
}

function num(value) {
  if (value === undefined || value === null || value === "") return null
  const n = typeof value === "number" ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function quoteRank(address) {
  return RAIL_RANK[String(address || "").toLowerCase()] || 1
}

function tokenSide(pair, tokenAddress) {
  const wanted = String(tokenAddress || "").toLowerCase()
  const base = pair.baseToken || {}
  const quote = pair.quoteToken || {}
  if ((base.address || "").toLowerCase() === wanted) return { token: base, asBase: true }
  return { token: quote, asBase: false }
}

function tokenUsd(pair, tokenAddress) {
  const wanted = String(tokenAddress || "").toLowerCase()
  const base = ((pair && pair.baseToken && pair.baseToken.address) || "").toLowerCase()
  const usd = num(pair && pair.priceUsd)
  if (usd === null) return null
  if (base === wanted) return usd
  const native = num(pair && pair.priceNative)
  if (native === null || native === 0) return null
  const inverted = usd / native
  if (!Number.isFinite(inverted) || inverted <= 0) return null
  return inverted
}

function pairScore(pair, tokenAddress) {
  const wanted = String(tokenAddress || "").toLowerCase()
  const base = ((pair.baseToken && pair.baseToken.address) || "").toLowerCase()
  const quote = ((pair.quoteToken && pair.quoteToken.address) || "").toLowerCase()
  const asBase = base === wanted
  const rail = asBase ? quote : base
  const liq = num(pair.liquidity && pair.liquidity.usd) || 0
  const depth = Math.log10(liq + 10)
  return depth * depth * quoteRank(rail) * (asBase ? 2 : 1)
}

function pickPair(pairs, tokenAddress) {
  const wanted = String(tokenAddress || "").toLowerCase()
  const list = Array.isArray(pairs) ? pairs : []
  const eligible = []
  for (let i = 0; i < list.length; i++) {
    const pair = list[i]
    if (!pair || pair.chainId !== "pulsechain") continue
    const base = ((pair.baseToken && pair.baseToken.address) || "").toLowerCase()
    const quote = ((pair.quoteToken && pair.quoteToken.address) || "").toLowerCase()
    if (base !== wanted && quote !== wanted) continue
    if (tokenUsd(pair, wanted) === null) continue
    eligible.push(pair)
  }
  const pulsex = eligible.filter((pair) => String(pair.dexId || "").toLowerCase() === "pulsex")
  const pool = pulsex.length ? pulsex : eligible
  let best = null
  let bestScore = -1
  for (let i = 0; i < pool.length; i++) {
    const score = pairScore(pool[i], wanted)
    if (score > bestScore) {
      bestScore = score
      best = pool[i]
    }
  }
  return best
}

function changeMap(pair) {
  const ch = pair.priceChange || {}
  return {
    "1h": num(ch.h1),
    "6h": num(ch.h6),
    "24h": num(ch.h24)
  }
}

async function fetchPrices(coins) {
  const results = []
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i]
    const address = String(coin.address || "")
    if (!ADDRESS_RE.test(address)) continue
    const url = "https://api.dexscreener.com/token-pairs/v1/pulsechain/" + address
    let payload
    try {
      payload = await getJson(url)
    } catch (err) {
      results.push({
        id: coin.id,
        address: address.toLowerCase(),
        error: err.message || "Network error"
      })
      continue
    }
    const pair = pickPair(payload, address)
    if (!pair) {
      results.push({
        id: coin.id,
        address: address.toLowerCase(),
        error: "No pair"
      })
      continue
    }
    const side = tokenSide(pair, address)
    const token = side.token || {}
    results.push({
      id: coin.id,
      address: address.toLowerCase(),
      symbol: String(token.symbol || coin.symbol || "").slice(0, 48),
      name: String(token.name || coin.name || "").slice(0, 128),
      price: tokenUsd(pair, address),
      change: side.asBase ? changeMap(pair) : { "1h": null, "6h": null, "24h": null },
      volume24h: num(pair.volume && pair.volume.h24),
      liquidity: num(pair.liquidity && pair.liquidity.usd),
      dex: String(pair.dexId || "").slice(0, 32),
      pair: String(pair.pairAddress || "").toLowerCase()
    })
  }
  return { source: "dexscreener", coins: results }
}

function searchId(address) {
  return "pls-" + String(address).slice(2).toLowerCase()
}

async function fetchSearch(query) {
  const q = String(query || "").trim()
  if (!q) return { source: "dexscreener", results: [] }
  const url = "https://api.dexscreener.com/latest/dex/search?q=" + encodeURIComponent(q)
  const payload = await getJson(url)
  const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
  const seen = {}
  const results = []
  for (let i = 0; i < pairs.length && results.length < 12; i++) {
    const pair = pairs[i]
    if (!pair || pair.chainId !== "pulsechain") continue
    const token = pair.baseToken || {}
    const address = String(token.address || "").toLowerCase()
    if (!ADDRESS_RE.test(address) || seen[address]) continue
    seen[address] = true
    results.push({
      id: searchId(address),
      address: address,
      symbol: String(token.symbol || "").slice(0, 48),
      name: String(token.name || "").slice(0, 128),
      price: num(pair.priceUsd),
      liquidity: num(pair.liquidity && pair.liquidity.usd)
    })
  }
  return { source: "dexscreener", results: results }
}

async function main() {
  const mode = process.argv[2]
  const raw = process.argv[3] || ""
  try {
    if (mode === "prices") {
      const coins = JSON.parse(raw)
      if (!Array.isArray(coins)) fail("Bad coins", 1)
      const out = await fetchPrices(coins)
      process.stdout.write(JSON.stringify(out))
      return
    }
    if (mode === "search") {
      const out = await fetchSearch(raw)
      process.stdout.write(JSON.stringify(out))
      return
    }
    fail("Usage: fetch.js prices <json> | search <query>", 1)
  } catch (err) {
    fail(err.message || "fetch failed", err.code || 1)
  }
}

module.exports = {
  ADDRESS_RE,
  DEX_HOST,
  MAX_BYTES,
  TIMEOUT_MS,
  WPLS,
  DAI,
  EUSDC,
  EUSDT,
  HEX,
  PLSX,
  isAllowedUrl,
  quoteRank,
  tokenSide,
  tokenUsd,
  pairScore,
  pickPair,
  changeMap,
  fetchPrices,
  fetchSearch
}

if (require.main === module) {
  main()
}
