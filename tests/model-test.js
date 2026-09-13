const assert = require("assert")
const Model = require("../Model.js")

assert.deepStrictEqual(Model.DEFAULT_COINS.map((c) => c.id), ["hex", "pls", "plsx", "inc", "prvx", "ehex"])
assert.deepStrictEqual(Model.DEFAULT_COINS.map((c) => c.symbol), ["HEX", "PLS", "PLSX", "INC", "PRVX", "eHEX"])
assert.strictEqual(Model.DEFAULT_COINS[0].address, "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39")
assert.strictEqual(Model.DEFAULT_COINS[4].address, "0xf6f8db0aba00007681f8faf16a0fda1c9b030b11")
assert.strictEqual(Model.DEFAULT_COINS[5].address, "0x57fde0a71132198bbec939b98976993d8d89d225")
assert.notStrictEqual(Model.DEFAULT_COINS[0].address, Model.DEFAULT_COINS[5].address)

assert.deepStrictEqual(Model.coinsFromSettings(undefined).map((c) => c.id), ["hex", "pls", "plsx", "inc", "prvx", "ehex"])
assert.deepStrictEqual(Model.coinsFromSettings({}).map((c) => c.id), ["hex", "pls", "plsx", "inc", "prvx", "ehex"])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: [] }), [])
assert.deepStrictEqual(Model.coinsFromSettings({ coins: ["hex", "ehex"] }).map((c) => c.symbol), ["HEX", "eHEX"])

const byAddress = Model.normalizeCoin({ address: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab" })
assert.strictEqual(byAddress.id, "plsx")
assert.strictEqual(byAddress.symbol, "PLSX")

assert.strictEqual(Model.normalizeCoin("bitcoin"), null)
assert.strictEqual(Model.normalizeCoin("hex").symbol, "HEX")
assert.strictEqual(Model.normalizeCoin("HEX").id, "hex")

const unknown = Model.normalizeCoin({
  address: "0x1111111111111111111111111111111111111111",
  symbol: "foo",
  name: "Foo Token"
})
assert.strictEqual(unknown.id, "pls-1111111111111111111111111111111111111111")
assert.strictEqual(unknown.symbol, "FOO")

assert.deepStrictEqual(Model.addCoin(Model.DEFAULT_COINS, { id: "hdrn" }).map((c) => c.id).slice(-1), ["hdrn"])
assert.deepStrictEqual(Model.removeCoin(Model.DEFAULT_COINS, "ehex").map((c) => c.id), ["hex", "pls", "plsx", "inc", "prvx"])

assert.deepStrictEqual(Model.WINDOWS.map((w) => w.key), ["1h", "6h", "24h"])
assert.strictEqual(Model.normalizeWindow("6h"), "6h")
assert.strictEqual(Model.normalizeWindow("7d"), "24h")
assert.strictEqual(Model.normalizePrimary({ primary: "plsx" }, Model.DEFAULT_COINS), "plsx")
assert.strictEqual(Model.normalizePrimary({ primary: "nope" }, Model.DEFAULT_COINS), "hex")
assert.strictEqual(Model.nextPrimary(Model.DEFAULT_COINS, "hex"), "pls")
assert.strictEqual(Model.nextPrimary(Model.DEFAULT_COINS, "ehex"), "hex")

const payload = JSON.stringify({
  source: "dexscreener",
  coins: [
    { id: "hex", price: 0.003615, change: { "1h": -0.7, "6h": -0.79, "24h": 3.97 } },
    { id: "pls", price: 0.00001053, change: { "1h": 0.1, "6h": -2.1, "24h": -4.2 } },
    { id: "plsx", price: 0.00001050, change: { "24h": 0.02 } },
    { id: "inc", price: 0.5732, change: { "24h": 1.2 } },
    { id: "prvx", price: 0.00009258, change: { "24h": 12.7 } },
    { id: "ehex", price: 0.001305, change: { "24h": 2.53 } }
  ]
})

const markets = Model.parseMarkets(payload, Model.DEFAULT_COINS, "24h")
assert.strictEqual(markets.ok, true)
assert.strictEqual(markets.coins[0].symbol, "HEX")
assert.strictEqual(markets.coins[0].price, 0.003615)
assert.strictEqual(markets.coins[0].change, 3.97)
assert.strictEqual(markets.coins[0].originLabel, "PulseChain HEX")
assert.strictEqual(markets.coins[4].symbol, "PRVX")
assert.strictEqual(markets.coins[5].symbol, "eHEX")
assert.strictEqual(markets.coins[5].originLabel, "Bridged from Ethereum")

const hour = Model.parseMarkets(payload, Model.DEFAULT_COINS, "1h")
assert.strictEqual(hour.coins[0].change, -0.7)

assert.strictEqual(Model.formatPrice(0.003615), "$0.003615")
assert.strictEqual(Model.formatPrice(0.00001053), "$0.00001053")
assert.strictEqual(Model.formatPrice(0.5732), "$0.5732")
assert.strictEqual(Model.formatPrice(77314), "$77,314.00")
assert.ok(!Model.formatPrice(0.00001053).includes("e-"))
assert.ok(!Model.formatPrice(0.00001053).includes("e+"))

assert.strictEqual(Model.formatChange(3.973), "+3.97%")
assert.strictEqual(Model.formatChange(-8.59), "-8.59%")
assert.strictEqual(Model.trendGlyph(1), "▲")
assert.ok(Model.barLabel(markets.coins[0]).indexOf("HEX") === 0)
assert.strictEqual(Model.tickerEnabled(undefined), false)
assert.strictEqual(Model.tickerEnabled({ ticker: true }), true)
assert.strictEqual(Model.tickerWidth({ tickerWidth: 90 }), 160)
assert.ok(Model.tickerText(markets.coins).indexOf("HEX") === 0)
assert.ok(Model.tickerText(markets.coins).indexOf("PRVX") > 0)
assert.strictEqual(Model.tickerParts(markets.coins).length, 6)

const cmd = Model.fetchCommand("file:///tmp/bin/fetch.js", Model.DEFAULT_COINS)
assert.strictEqual(cmd[0], "node")
assert.strictEqual(cmd[1], "/tmp/bin/fetch.js")
assert.strictEqual(cmd[2], "prices")
const compact = JSON.parse(cmd[3])
assert.strictEqual(compact[0].id, "hex")
assert.strictEqual(compact[0].address, "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39")

assert.deepStrictEqual(Model.searchCommand("file:///tmp/bin/fetch.js", "hex"), ["node", "/tmp/bin/fetch.js", "search", "hex"])
assert.deepStrictEqual(Model.searchCommand("file:///tmp/bin/fetch.js", "  "), [])

const local = Model.catalogSearch("hex", [])
assert.ok(local.some((c) => c.id === "hex"))
assert.ok(local.some((c) => c.id === "ehex"))
assert.ok(!local.some((c) => c.id === "pls"))

const parsedSearch = Model.parseSearch("", Model.DEFAULT_COINS, "")
assert.ok(parsedSearch.results.some((c) => c.id === "hdrn"))
assert.ok(!parsedSearch.results.some((c) => c.id === "hex"))

const remoteSearch = Model.parseSearch(JSON.stringify({
  results: [{ address: "0x1111111111111111111111111111111111111111", symbol: "FOO", name: "Foo" }]
}), [], "foo")
assert.ok(remoteSearch.results.some((c) => c.id === "pls-1111111111111111111111111111111111111111"))

assert.strictEqual(Model.shouldFetch(null, 1000, 45000), true)
assert.strictEqual(Model.shouldFetch(1000, 46000, 45000), true)
assert.strictEqual(Model.shouldFetch(1000, 44999, 45000), false)

assert.strictEqual(Model.errorForExit(22), "Rate limited")
assert.strictEqual(Model.formatUpdatedAt(new Date(2026, 7, 21, 9, 5)), "09:05")

console.log("model-test: ok")
