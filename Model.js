var DEFAULT_COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" }
]

var WINDOWS = [
  { key: "1h", label: "1h", field: "price_change_percentage_1h_in_currency" },
  { key: "24h", label: "24h", field: "price_change_percentage_24h_in_currency" },
  { key: "7d", label: "7d", field: "price_change_percentage_7d_in_currency" }
]

var DEFAULT_WINDOW = "24h"
var SEARCH_LIMIT = 6
var MIN_FETCH_INTERVAL_MS = 30000

var MARKETS_ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets"
var SEARCH_ENDPOINT = "https://api.coingecko.com/api/v3/search"

function text(value) {
  return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null
  var number = typeof value === "number" ? value : parseFloat(String(value))
  return isFinite(number) ? number : null
}

function capitalize(value) {
  return value === "" ? "" : value.charAt(0).toUpperCase() + value.substring(1)
}

function isArrayLike(value) {
  if (!value || typeof value === "string" || typeof value === "number") return false
  if (Object.prototype.toString.call(value) === "[object Array]") return true
  return typeof value.length === "number" && value.length >= 0
}

function toArray(value) {
  if (!isArrayLike(value)) return []
  var items = []
  for (var i = 0; i < value.length; i++) items.push(value[i])
  return items
}

function normalizeCoin(value) {
  if (typeof value === "string") {
    var id = text(value).toLowerCase()
    if (id === "") return null
    return { id: id, symbol: id.toUpperCase(), name: capitalize(id) }
  }
  if (!value || typeof value !== "object") return null
  var coinId = text(value.id).toLowerCase()
  if (coinId === "") return null
  var symbol = text(value.symbol).toUpperCase() || coinId.toUpperCase()
  var name = text(value.name) || capitalize(coinId)
  return { id: coinId, symbol: symbol, name: name }
}

function normalizeCoins(values) {
  var list = toArray(values)
  var coins = []
  var seen = {}
  for (var i = 0; i < list.length; i++) {
    var coin = normalizeCoin(list[i])
    if (!coin || seen[coin.id]) continue
    seen[coin.id] = true
    coins.push(coin)
  }
  return coins
}

function coinsFromSettings(settings) {
  var configured = settings ? settings.coins : undefined
  if (!isArrayLike(configured)) return DEFAULT_COINS.slice()
  return normalizeCoins(configured)
}

function addCoin(coins, coin) {
  var list = toArray(coins)
  var normalized = normalizeCoin(coin)
  if (!normalized) return normalizeCoins(list)
  return normalizeCoins(list.concat([normalized]))
}

function removeCoin(coins, id) {
  var target = text(id).toLowerCase()
  var list = toArray(coins)
  var kept = []
  for (var i = 0; i < list.length; i++) {
    if (text(list[i].id).toLowerCase() !== target) kept.push(list[i])
  }
  return kept
}

function windowEntry(key) {
  var wanted = text(key).toLowerCase()
  for (var i = 0; i < WINDOWS.length; i++)
    if (WINDOWS[i].key === wanted) return WINDOWS[i]
  return null
}

function normalizeWindow(key) {
  var entry = windowEntry(key)
  return entry ? entry.key : DEFAULT_WINDOW
}

function windowLabel(key) {
  var entry = windowEntry(key)
  return entry ? entry.label : windowEntry(DEFAULT_WINDOW).label
}

function windowField(key) {
  var entry = windowEntry(key) || windowEntry(DEFAULT_WINDOW)
  return entry.field
}

function coinIds(coins) {
  var list = toArray(coins)
  var ids = []
  for (var i = 0; i < list.length; i++) ids.push(list[i].id)
  return ids
}

function priceUrl(coins) {
  if (!isArrayLike(coins) || coins.length === 0) return ""
  return MARKETS_ENDPOINT
    + "?vs_currency=usd"
    + "&ids=" + coinIds(coins).join(",")
    + "&price_change_percentage=1h,24h,7d"
    + "&sparkline=false"
}

function searchUrl(query) {
  var trimmed = text(query)
  if (trimmed === "") return ""
  return SEARCH_ENDPOINT + "?query=" + encodeURIComponent(trimmed)
}

function decode(raw) {
  var body = text(raw)
  if (body === "") return { error: "No response" }
  var payload
  try {
    payload = JSON.parse(body)
  } catch (e) {
    return { error: "Bad response" }
  }
  if (!payload || typeof payload !== "object") return { error: "Bad response" }
  if (!(payload instanceof Array) && payload.status && toNumber(payload.status.error_code) === 429)
    return { error: "Rate limited" }
  return { payload: payload }
}

function placeholderCoins(coins) {
  var list = toArray(coins)
  var rows = []
  for (var i = 0; i < list.length; i++) {
    rows.push({
      id: list[i].id,
      symbol: list[i].symbol,
      name: list[i].name,
      price: null,
      change: null
    })
  }
  return rows
}

function parseMarkets(raw, coins, windowKey) {
  var wanted = toArray(coins)
  if (wanted.length === 0) return { ok: false, coins: [], error: "No coins" }

  var decoded = decode(raw)
  if (decoded.error) return { ok: false, coins: [], error: decoded.error }
  var rows = decoded.payload
  if (!(rows instanceof Array) || rows.length === 0) return { ok: false, coins: [], error: "No prices" }

  var field = windowField(windowKey)
  var byId = {}
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    if (row && row.id) byId[text(row.id).toLowerCase()] = row
  }

  var priced = 0
  var parsed = []
  for (var c = 0; c < wanted.length; c++) {
    var coin = wanted[c]
    var match = byId[coin.id]
    var price = match ? toNumber(match.current_price) : null
    if (price !== null) priced++
    parsed.push({
      id: coin.id,
      symbol: match && text(match.symbol) !== "" ? text(match.symbol).toUpperCase() : coin.symbol,
      name: match && text(match.name) !== "" ? text(match.name) : coin.name,
      price: price,
      change: match ? toNumber(match[field]) : null
    })
  }

  if (priced === 0) return { ok: false, coins: [], error: "No prices" }
  return { ok: true, coins: parsed, error: "" }
}

function parseSearch(raw, existingCoins) {
  var decoded = decode(raw)
  if (decoded.error) return { ok: false, results: [], error: decoded.error }

  var found = decoded.payload.coins
  if (!(found instanceof Array) || found.length === 0)
    return { ok: false, results: [], error: "No matches" }

  var taken = {}
  var existing = toArray(existingCoins)
  for (var e = 0; e < existing.length; e++) taken[text(existing[e].id).toLowerCase()] = true

  var results = []
  for (var i = 0; i < found.length && results.length < SEARCH_LIMIT; i++) {
    var coin = normalizeCoin(found[i])
    if (!coin || taken[coin.id]) continue
    taken[coin.id] = true
    results.push(coin)
  }

  if (results.length === 0) return { ok: false, results: [], error: "No matches" }
  return { ok: true, results: results, error: "" }
}

function shouldFetch(lastFetchAt, now, minIntervalMs) {
  var last = toNumber(lastFetchAt)
  if (last === null) return true
  var elapsed = toNumber(now) - last
  return elapsed >= minIntervalMs || elapsed < 0
}

function groupThousands(digits) {
  var out = ""
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ","
    out += digits.charAt(i)
  }
  return out
}

function formatSubUnitPrice(number) {
  var precise = number.toPrecision(4)
  if (precise.indexOf(".") < 0) return precise
  var trimmed = precise.replace(/0+$/, "")
  var decimals = trimmed.length - trimmed.indexOf(".") - 1
  return decimals >= 2 ? trimmed : number.toFixed(2)
}

function formatPrice(value) {
  var number = toNumber(value)
  if (number === null) return "—"
  if (number < 1) return "$" + formatSubUnitPrice(number)
  var fixed = number.toFixed(2)
  var dot = fixed.indexOf(".")
  return "$" + groupThousands(fixed.substring(0, dot)) + fixed.substring(dot)
}

function formatChange(value) {
  var number = toNumber(value)
  if (number === null) return "—"
  var body = number.toFixed(2) + "%"
  return number > 0 ? "+" + body : body
}

function trend(value) {
  var number = toNumber(value)
  if (number === null || number === 0) return "flat"
  return number > 0 ? "up" : "down"
}

function errorForExit(code) {
  var number = toNumber(code)
  if (number === 0) return ""
  if (number === 22) return "Rate limited"
  if (number === 28) return "Timed out"
  if (number === 6 || number === 7) return "Offline"
  return "Network error"
}

function pad2(value) {
  var number = Number(value)
  return (number < 10 ? "0" : "") + number
}

function formatUpdatedAt(date) {
  if (!date || typeof date.getHours !== "function") return ""
  return pad2(date.getHours()) + ":" + pad2(date.getMinutes())
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DEFAULT_COINS: DEFAULT_COINS,
    WINDOWS: WINDOWS,
    DEFAULT_WINDOW: DEFAULT_WINDOW,
    SEARCH_LIMIT: SEARCH_LIMIT,
    MIN_FETCH_INTERVAL_MS: MIN_FETCH_INTERVAL_MS,
    coinsFromSettings: coinsFromSettings,
    addCoin: addCoin,
    removeCoin: removeCoin,
    normalizeWindow: normalizeWindow,
    windowLabel: windowLabel,
    windowField: windowField,
    priceUrl: priceUrl,
    searchUrl: searchUrl,
    parseMarkets: parseMarkets,
    parseSearch: parseSearch,
    placeholderCoins: placeholderCoins,
    shouldFetch: shouldFetch,
    formatPrice: formatPrice,
    formatChange: formatChange,
    trend: trend,
    errorForExit: errorForExit,
    formatUpdatedAt: formatUpdatedAt
  }
}
