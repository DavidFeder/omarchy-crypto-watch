const assert = require("assert")
const fetch = require("../bin/fetch.js")

const HEX = fetch.HEX
const WPLS = fetch.WPLS
const DAI = fetch.DAI
const EUSDC = fetch.EUSDC
const PDAI = "0x6b175474e89094c44da98b954eedeac495271d0f"
const BXUSD = "0x1111111111111111111111111111111111111111"

function pair(partial) {
  return Object.assign(
    {
      chainId: "pulsechain",
      dexId: "pulsex",
      pairAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      priceUsd: "1",
      priceNative: "1",
      liquidity: { usd: 1000000 },
      volume: { h24: 50000 },
      priceChange: { h1: 1, h6: 2, h24: 3 },
      baseToken: { address: HEX, symbol: "HEX", name: "HEX" },
      quoteToken: { address: DAI, symbol: "DAI", name: "DAI" }
    },
    partial
  )
}

assert.strictEqual(fetch.isAllowedUrl("https://api.dexscreener.com/token-pairs/v1/pulsechain/" + HEX), true)
assert.strictEqual(fetch.isAllowedUrl("https://api.coingecko.com/api/v3/coins/markets"), false)
assert.strictEqual(fetch.isAllowedUrl("http://api.dexscreener.com/latest/dex/search?q=hex"), false)
assert.strictEqual(fetch.isAllowedUrl("https://evil.example/api.dexscreener.com"), false)

assert.strictEqual(fetch.quoteRank(DAI), 8)
assert.strictEqual(fetch.quoteRank(EUSDC), 8)
assert.strictEqual(fetch.quoteRank(WPLS), 6)
assert.strictEqual(fetch.quoteRank(PDAI), 1)
assert.strictEqual(fetch.quoteRank("DAI"), 1)

const hexDai = pair({
  priceUsd: "0.003598",
  priceNative: "0.0036",
  liquidity: { usd: 884491 },
  baseToken: { address: HEX, symbol: "HEX", name: "HEX" },
  quoteToken: { address: DAI, symbol: "DAI", name: "Dai Stablecoin from Ethereum" }
})
assert.strictEqual(fetch.tokenUsd(hexDai, HEX), 0.003598)
assert.ok(Math.abs(fetch.tokenUsd(hexDai, DAI) - 0.003598 / 0.0036) < 1e-9)
assert.strictEqual(fetch.tokenSide(hexDai, HEX).asBase, true)
assert.strictEqual(fetch.tokenSide(hexDai, DAI).asBase, false)

const junkDai = pair({
  dexId: "liberty-swap",
  pairAddress: "0x7e73afa060fec3320862e707eb73b6b4c84fdea2",
  priceUsd: "1.0011",
  priceNative: "1.0",
  liquidity: { usd: 9640603933.71 },
  volume: { h24: 37.18 },
  priceChange: { h1: null, h6: null, h24: null },
  baseToken: { address: BXUSD, symbol: "BXUSD", name: "BXUSD" },
  quoteToken: { address: DAI, symbol: "DAI", name: "DAI" }
})
const wplsDai = pair({
  pairAddress: "0x6753560538eca67617a9ce605178f788be7e524e",
  priceUsd: "0.00001199",
  priceNative: "0.00001199",
  liquidity: { usd: 955483 },
  volume: { h24: 405496 },
  baseToken: { address: WPLS, symbol: "WPLS", name: "Wrapped Pulse" },
  quoteToken: { address: DAI, symbol: "DAI", name: "DAI" }
})

const daiPick = fetch.pickPair([junkDai, hexDai, wplsDai], DAI)
assert.strictEqual(daiPick.pairAddress, wplsDai.pairAddress)
assert.strictEqual(daiPick.dexId, "pulsex")
assert.ok(Math.abs(fetch.tokenUsd(daiPick, DAI) - 1) < 1e-9)
assert.notStrictEqual(fetch.tokenUsd(daiPick, DAI), 0.00001199)

const hexVsJunk = fetch.pickPair(
  [
    pair({
      dexId: "liberty-swap",
      priceUsd: "76",
      liquidity: { usd: 9e9 },
      baseToken: { address: HEX, symbol: "HEX", name: "HEX" },
      quoteToken: { address: BXUSD, symbol: "BXUSD", name: "BXUSD" }
    }),
    hexDai
  ],
  HEX
)
assert.strictEqual(hexVsJunk.dexId, "pulsex")
assert.strictEqual(fetch.tokenUsd(hexVsJunk, HEX), 0.003598)

const wplsPdai = pair({
  pairAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  priceUsd: "0.000012",
  priceNative: "0.000012",
  liquidity: { usd: 5000000 },
  baseToken: { address: WPLS, symbol: "WPLS", name: "Wrapped Pulse" },
  quoteToken: { address: PDAI, symbol: "DAI", name: "Dai Stablecoin" }
})
const wplsBridged = pair({
  pairAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
  priceUsd: "0.00001199",
  priceNative: "0.00001199",
  liquidity: { usd: 900000 },
  baseToken: { address: WPLS, symbol: "WPLS", name: "Wrapped Pulse" },
  quoteToken: { address: DAI, symbol: "DAI", name: "Dai Stablecoin from Ethereum" }
})
const wplsPick = fetch.pickPair([wplsPdai, wplsBridged], WPLS)
assert.strictEqual(wplsPick.pairAddress, wplsBridged.pairAddress)

const plsxWpls = pair({
  pairAddress: "0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9",
  priceUsd: "0.00001033",
  priceNative: "0.86",
  liquidity: { usd: 2561411 },
  baseToken: { address: fetch.PLSX, symbol: "PLSX", name: "PulseX" },
  quoteToken: { address: WPLS, symbol: "WPLS", name: "Wrapped Pulse" }
})
const plsxDaiThin = pair({
  pairAddress: "0xb2893cea8080bf43b7b60b589edaab5211d98f23",
  priceUsd: "0.00001034",
  priceNative: "0.00001034",
  liquidity: { usd: 115491 },
  baseToken: { address: fetch.PLSX, symbol: "PLSX", name: "PulseX" },
  quoteToken: { address: DAI, symbol: "DAI", name: "DAI" }
})
const plsxPick = fetch.pickPair([plsxDaiThin, plsxWpls], fetch.PLSX)
assert.strictEqual(plsxPick.pairAddress, plsxWpls.pairAddress)

const onlyJunk = fetch.pickPair([junkDai], DAI)
assert.ok(onlyJunk)
assert.strictEqual(onlyJunk.dexId, "liberty-swap")
assert.ok(Math.abs(fetch.tokenUsd(onlyJunk, DAI) - 1.0011) < 1e-9)

assert.strictEqual(fetch.pickPair([hexDai], "0x0000000000000000000000000000000000000000"), null)
assert.strictEqual(fetch.pickPair([], HEX), null)

console.log("fetch-test: ok")
