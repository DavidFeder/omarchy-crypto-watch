const assert = require("assert")
const fs = require("fs")
const path = require("path")
const Model = require("../Model.js")

const marketsFixture = fs.readFileSync(path.join(__dirname, "fixtures/markets.json"), "utf8")
const searchFixture = fs.readFileSync(path.join(__dirname, "fixtures/search.json"), "utf8")

assert.deepStrictEqual(Model.DEFAULT_COINS.map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.DEFAULT_COINS.map((c) => c.symbol), ["BTC", "ETH", "SOL"])

assert.deepStrictEqual(Model.coinsFromSettings(undefined).map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.coinsFromSettings(null).map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.coinsFromSettings({}).map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: "nope" }).map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: [] }), [])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: [null, {}, 7, { id: "" }] }), [])

const custom = Model.coinsFromSettings({ coins: [{ id: " Solana ", symbol: "sol", name: " Solana " }, "dogecoin"] })
assert.deepStrictEqual(custom, [
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "dogecoin", symbol: "DOGECOIN", name: "Dogecoin" }
])

const deduped = Model.coinsFromSettings({ coins: [{ id: "bitcoin", symbol: "BTC", name: "Bitcoin" }, { id: "BITCOIN", symbol: "XXX", name: "Dupe" }] })
assert.strictEqual(deduped.length, 1)
assert.strictEqual(deduped[0].symbol, "BTC")

function sequenceLike(items) {
  const fake = { length: items.length }
  items.forEach((item, i) => { fake[i] = item })
  return fake
}

const v4 = sequenceLike([
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "cardano", symbol: "ADA", name: "Cardano" }
])
assert.strictEqual(Array.isArray(v4), false)
assert.deepStrictEqual(Model.coinsFromSettings({ coins: v4 }).map((c) => c.symbol), ["BTC", "ETH", "SOL", "ADA"])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: sequenceLike([]) }), [])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: sequenceLike(["dogecoin"]) }).map((c) => c.id), ["dogecoin"])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: "bitcoin" }).map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: 3 }).map((c) => c.id), ["bitcoin", "ethereum", "solana"])

const v4Two = sequenceLike([{ id: "bitcoin", symbol: "BTC", name: "Bitcoin" }, { id: "solana", symbol: "SOL", name: "Solana" }])
assert.deepStrictEqual(Model.addCoin(v4Two, { id: "cardano", symbol: "ADA", name: "Cardano" }).map((c) => c.id), ["bitcoin", "solana", "cardano"])
assert.deepStrictEqual(Model.removeCoin(v4Two, "bitcoin").map((c) => c.id), ["solana"])
assert.deepStrictEqual(Model.placeholderCoins(v4Two).map((c) => c.symbol), ["BTC", "SOL"])
assert.deepStrictEqual(Model.parseMarkets(marketsFixture, v4Two, "24h").coins.map((c) => c.symbol), ["BTC", "SOL"])
assert.strictEqual(Model.priceUrl(v4Two).indexOf("ids=bitcoin,solana") > 0, true)
assert.strictEqual(Model.parseSearch(searchFixture, sequenceLike([{ id: "solana", symbol: "SOL", name: "Solana" }])).results.some((r) => r.id === "solana"), false)

const base = Model.DEFAULT_COINS.slice()
const added = Model.addCoin(base, { id: "cardano", symbol: "ada", name: "Cardano" })
assert.deepStrictEqual(added.map((c) => c.id), ["bitcoin", "ethereum", "solana", "cardano"])
assert.strictEqual(added[3].symbol, "ADA")
assert.strictEqual(base.length, 3)
assert.deepStrictEqual(Model.addCoin(base, { id: "BITCOIN", symbol: "BTC", name: "Bitcoin" }).map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.addCoin(base, null).map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.addCoin(base, { id: "" }).map((c) => c.id), ["bitcoin", "ethereum", "solana"])

assert.deepStrictEqual(Model.removeCoin(base, "ethereum").map((c) => c.id), ["bitcoin", "solana"])
assert.deepStrictEqual(Model.removeCoin(base, "ETHEREUM").map((c) => c.id), ["bitcoin", "solana"])
assert.deepStrictEqual(Model.removeCoin(base, "nothing").map((c) => c.id), ["bitcoin", "ethereum", "solana"])
assert.deepStrictEqual(Model.removeCoin([{ id: "bitcoin", symbol: "BTC", name: "Bitcoin" }], "bitcoin"), [])
assert.strictEqual(base.length, 3)

assert.deepStrictEqual(Model.WINDOWS.map((w) => w.key), ["1h", "24h", "7d"])
assert.strictEqual(Model.DEFAULT_WINDOW, "24h")
assert.strictEqual(Model.normalizeWindow("1h"), "1h")
assert.strictEqual(Model.normalizeWindow("1H"), "1h")
assert.strictEqual(Model.normalizeWindow(" 7d "), "7d")
assert.strictEqual(Model.normalizeWindow(""), "24h")
assert.strictEqual(Model.normalizeWindow(null), "24h")
assert.strictEqual(Model.normalizeWindow("30d"), "24h")
assert.strictEqual(Model.windowLabel("7d"), "7d")

const url = Model.priceUrl(Model.DEFAULT_COINS)
assert.strictEqual(url.indexOf("api.coingecko.com/api/v3/coins/markets") > 0, true)
assert.strictEqual(url.indexOf("vs_currency=usd") > 0, true)
assert.strictEqual(url.indexOf("ids=bitcoin,ethereum,solana") > 0, true)
assert.strictEqual(url.indexOf("price_change_percentage=1h,24h,7d") > 0, true)
assert.strictEqual(url.indexOf("sparkline=false") > 0, true)
assert.strictEqual(/[?&]_=/.test(url), false)
assert.strictEqual(Model.priceUrl([]), "")

const markets24 = Model.parseMarkets(marketsFixture, Model.DEFAULT_COINS, "24h")
assert.strictEqual(markets24.ok, true)
assert.strictEqual(markets24.error, "")
assert.deepStrictEqual(markets24.coins.map((c) => c.symbol), ["BTC", "ETH", "SOL"])
assert.strictEqual(markets24.coins[0].price, 78320)
assert.strictEqual(markets24.coins[0].change, 7.7)
assert.strictEqual(markets24.coins[2].price, 93.69)
assert.strictEqual(markets24.coins[2].change, 7.4)

const markets1h = Model.parseMarkets(marketsFixture, Model.DEFAULT_COINS, "1h")
assert.strictEqual(markets1h.coins[0].change, -0.2)
const markets7d = Model.parseMarkets(marketsFixture, Model.DEFAULT_COINS, "7d")
assert.strictEqual(markets7d.coins[0].change, 24.6)
assert.strictEqual(markets7d.coins[1].change, 33.9)

const reordered = Model.parseMarkets(marketsFixture, [
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" }
], "24h")
assert.deepStrictEqual(reordered.coins.map((c) => c.symbol), ["SOL", "BTC"])
assert.strictEqual(reordered.coins[0].price, 93.69)

const enriched = Model.parseMarkets(marketsFixture, [{ id: "solana", symbol: "SOLANA", name: "solana" }], "24h")
assert.strictEqual(enriched.coins[0].symbol, "SOL")
assert.strictEqual(enriched.coins[0].name, "Solana")

const missing = Model.parseMarkets(marketsFixture, [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "nosuchcoin", symbol: "NOPE", name: "Nope" }
], "24h")
assert.strictEqual(missing.ok, true)
assert.strictEqual(missing.coins[1].price, null)
assert.strictEqual(missing.coins[1].change, null)
assert.strictEqual(missing.coins[1].symbol, "NOPE")

assert.strictEqual(Model.parseMarkets("", Model.DEFAULT_COINS, "24h").error, "No response")
assert.strictEqual(Model.parseMarkets(null, Model.DEFAULT_COINS, "24h").error, "No response")
assert.strictEqual(Model.parseMarkets("<html>429</html>", Model.DEFAULT_COINS, "24h").error, "Bad response")
assert.strictEqual(Model.parseMarkets("[]", Model.DEFAULT_COINS, "24h").error, "No prices")
assert.strictEqual(Model.parseMarkets('{"status":{"error_code":429}}', Model.DEFAULT_COINS, "24h").error, "Rate limited")
assert.strictEqual(Model.parseMarkets(marketsFixture, [], "24h").error, "No coins")

assert.strictEqual(Model.searchUrl("sol").indexOf("api.coingecko.com/api/v3/search?query=sol") > 0, true)
assert.strictEqual(Model.searchUrl("bitcoin cash").indexOf("query=bitcoin%20cash") > 0, true)
assert.strictEqual(Model.searchUrl("  "), "")
assert.strictEqual(Model.searchUrl(null), "")

const found = Model.parseSearch(searchFixture, [])
assert.strictEqual(found.ok, true)
assert.strictEqual(found.error, "")
assert.strictEqual(found.results.length, Model.SEARCH_LIMIT)
assert.deepStrictEqual(found.results[0], { id: "solana", symbol: "SOL", name: "Solana" })

const filtered = Model.parseSearch(searchFixture, [{ id: "solana", symbol: "SOL", name: "Solana" }])
assert.strictEqual(filtered.results.some((r) => r.id === "solana"), false)
assert.strictEqual(filtered.results.length, Model.SEARCH_LIMIT)

assert.strictEqual(Model.parseSearch("", []).error, "No response")
assert.strictEqual(Model.parseSearch("<html>", []).error, "Bad response")
assert.strictEqual(Model.parseSearch('{"coins":[]}', []).error, "No matches")
assert.strictEqual(Model.parseSearch('{"status":{"error_code":429}}', []).error, "Rate limited")

assert.strictEqual(Model.MIN_FETCH_INTERVAL_MS, 30000)
assert.strictEqual(Model.shouldFetch(null, 1000, 30000), true)
assert.strictEqual(Model.shouldFetch(0, 30000, 30000), true)
assert.strictEqual(Model.shouldFetch(1000, 31000, 30000), true)
assert.strictEqual(Model.shouldFetch(1000, 30999, 30000), false)
assert.strictEqual(Model.shouldFetch(5000, 1000, 30000), true)

assert.strictEqual(Model.formatPrice(78320), "$78,320.00")
assert.strictEqual(Model.formatPrice(2514.95), "$2,514.95")
assert.strictEqual(Model.formatPrice(93.69), "$93.69")
assert.strictEqual(Model.formatPrice(1234567.5), "$1,234,567.50")
assert.strictEqual(Model.formatPrice(0.5), "$0.50")
assert.strictEqual(Model.formatPrice(0.12345), "$0.1235")
assert.strictEqual(Model.formatPrice(0.000008234), "$0.000008234")
assert.strictEqual(Model.formatPrice(null), "—")
assert.strictEqual(Model.formatPrice(undefined), "—")

assert.strictEqual(Model.formatChange(7.1151069724448845), "+7.12%")
assert.strictEqual(Model.formatChange(-8.358937521622284), "-8.36%")
assert.strictEqual(Model.formatChange(0), "0.00%")
assert.strictEqual(Model.formatChange(null), "—")

assert.strictEqual(Model.trend(1.5), "up")
assert.strictEqual(Model.trend(-1.5), "down")
assert.strictEqual(Model.trend(0), "flat")
assert.strictEqual(Model.trend(null), "flat")

const hugeName = "N".repeat(2000000)
const hugeSymbol = "S".repeat(2000000)

assert.strictEqual(Model.MAX_NAME_CHARS, 96)
assert.strictEqual(Model.MAX_SYMBOL_CHARS, 24)

const clamped = Model.addCoin([], { id: "bitcoin", symbol: hugeSymbol, name: hugeName })
assert.strictEqual(clamped[0].name.length, 96)
assert.strictEqual(clamped[0].symbol.length, 24)

const clampedMarkets = Model.parseMarkets(
  JSON.stringify([{ id: "bitcoin", symbol: hugeSymbol, name: hugeName, current_price: 100 }]),
  [{ id: "bitcoin", symbol: "BTC", name: "Bitcoin" }],
  "24h"
)
assert.strictEqual(clampedMarkets.ok, true)
assert.strictEqual(clampedMarkets.coins[0].name.length, 96)
assert.strictEqual(clampedMarkets.coins[0].symbol.length, 24)

const hostileIds = ["x#frag", "a b", "bitcoin&vs_currency=eur", "", "-lead", "a".repeat(65), "a/b", "a%2e"]
hostileIds.forEach((id) => {
  assert.deepStrictEqual(Model.addCoin([], { id: id, symbol: "X", name: "X" }), [], "must reject id: " + id)
  assert.deepStrictEqual(Model.coinsFromSettings({ coins: [id] }), [], "must reject bare id: " + id)
})

const validIds = ["bitcoin", "0x0-ai-ai-smart-contract", "wall_street", "a.b", "BITCOIN"]
validIds.forEach((id) => {
  assert.strictEqual(Model.addCoin([], { id: id, symbol: "X", name: "X" }).length, 1, "must accept id: " + id)
})
assert.strictEqual(Model.addCoin([], { id: "BITCOIN", symbol: "X", name: "X" })[0].id, "bitcoin")

const hostileSearch = Model.parseSearch(
  JSON.stringify({ coins: [{ id: "x#frag", symbol: "X", name: "X" }, { id: "solana", symbol: "SOL", name: "Solana" }] }),
  []
)
assert.deepStrictEqual(hostileSearch.results.map((c) => c.id), ["solana"])

assert.ok(Model.priceUrl([{ id: "x#frag", symbol: "X", name: "X" }]).indexOf("ids=x%23frag") > 0)
assert.ok(Model.priceUrl(Model.DEFAULT_COINS).indexOf("ids=bitcoin,ethereum,solana") > 0)

assert.deepStrictEqual(Model.fetchCommand("https://api.coingecko.com/api/v3/search?query=btc"), [
  "curl",
  "-fsS",
  "--proto",
  "=https",
  "--max-filesize",
  "2097152",
  "--max-time",
  "10",
  "https://api.coingecko.com/api/v3/search?query=btc"
])
assert.strictEqual(Model.MAX_RESPONSE_BYTES, 2097152)

assert.strictEqual(Model.errorForExit(0), "")
assert.strictEqual(Model.errorForExit(22), "Rate limited")
assert.strictEqual(Model.errorForExit(28), "Timed out")
assert.strictEqual(Model.errorForExit(63), "Response too large")
assert.strictEqual(Model.errorForExit(6), "Offline")
assert.strictEqual(Model.errorForExit(7), "Offline")
assert.strictEqual(Model.errorForExit(1), "Network error")

assert.strictEqual(Model.formatUpdatedAt(new Date(2026, 7, 21, 9, 5)), "09:05")
assert.strictEqual(Model.formatUpdatedAt(null), "")

const placeholders = Model.placeholderCoins(Model.DEFAULT_COINS)
assert.deepStrictEqual(placeholders.map((c) => c.symbol), ["BTC", "ETH", "SOL"])
assert.strictEqual(placeholders[0].price, null)
assert.strictEqual(placeholders[0].change, null)

console.log("model-test: ok")
