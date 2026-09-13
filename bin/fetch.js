#!/usr/bin/env node
"use strict"

const https = require("https")
const { URL } = require("url")

const MAX_BYTES = 2097152
const TIMEOUT_MS = 10000
const DEX_HOST = "api.dexscreener.com"
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function fail(message, code) {
  process.stderr.write(String(message || "fetch failed") + "\n")
  process.exit(code || 1)
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
    if (parsed.protocol !== "https:" || parsed.hostname !== DEX_HOST) {
      reject(new Error("Blocked host"))
      return
    }
    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "admxn.pulsewatch" }
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

function quoteRank(symbol) {
  const s = String(symbol || "").toUpperCase()
  if (s === "DAI" || s === "USDC" || s === "USDT" || s === "EUSDC" || s === "EUSDT") return 3
  if (s === "WPLS" || s === "PLS") return 2
  return 1
}

function pickPair(pairs, tokenAddress) {
  const wanted = String(tokenAddress || "").toLowerCase()
  const list = Array.isArray(pairs) ? pairs : []
  let best = null
  let bestScore = -1
  for (let i = 0; i < list.length; i++) {
    const pair = list[i]
    if (!pair || pair.chainId !== "pulsechain") continue
    const base = (pair.baseToken && pair.baseToken.address || "").toLowerCase()
    const quote = (pair.quoteToken && pair.quoteToken.address || "").toLowerCase()
    if (base !== wanted && quote !== wanted) continue
    const liq = num(pair.liquidity && pair.liquidity.usd) || 0
    const usd = num(pair.priceUsd)
    if (usd === null) continue
    const quoteSym = base === wanted
      ? (pair.quoteToken && pair.quoteToken.symbol)
      : (pair.baseToken && pair.baseToken.symbol)
    const score = liq * quoteRank(quoteSym)
    if (score > bestScore) {
      bestScore = score
      best = pair
    }
  }
  return best
}

function tokenSide(pair, tokenAddress) {
  const wanted = String(tokenAddress || "").toLowerCase()
  const base = pair.baseToken || {}
  const quote = pair.quoteToken || {}
  if ((base.address || "").toLowerCase() === wanted) return { token: base, asBase: true }
  return { token: quote, asBase: false }
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
      price: num(pair.priceUsd),
      change: changeMap(pair),
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

main()
