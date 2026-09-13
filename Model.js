var ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
var COIN_ID_PATTERN = /^[a-z0-9._-]{1,128}$/
var SEARCH_LIMIT = 8
var MIN_FETCH_INTERVAL_MS = 45000
var MAX_RESPONSE_BYTES = 2097152
var MAX_NAME_CHARS = 128
var MAX_SYMBOL_CHARS = 48
var REQUEST_TIMEOUT_SECONDS = 12
var DEFAULT_WINDOW = "24h"
var DEFAULT_PRIMARY = "hex"
var DEFAULT_TICKER = false
var DEFAULT_TICKER_WIDTH = 280

var WINDOWS = [
  { key: "1h", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" }
]

var CATALOG = [
  {
    id: "hex",
    symbol: "HEX",
    displaySymbol: "HEX",
    name: "HEX (PulseChain)",
    address: "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39",
    origin: "state_fork",
    rh: true,
    core: true
  },
  {
    id: "pls",
    symbol: "PLS",
    displaySymbol: "PLS",
    name: "PulseChain",
    address: "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
    origin: "pulsechain",
    rh: true,
    core: true
  },
  {
    id: "plsx",
    symbol: "PLSX",
    displaySymbol: "PLSX",
    name: "PulseX",
    address: "0x95b303987a60c71504d99aa1b13b4da07b0790ab",
    origin: "pulsechain",
    rh: true,
    core: true
  },
  {
    id: "inc",
    symbol: "INC",
    displaySymbol: "INC",
    name: "Incentive",
    address: "0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d",
    origin: "pulsechain",
    rh: true,
    core: true
  },
  {
    id: "prvx",
    symbol: "PRVX",
    displaySymbol: "PRVX",
    name: "ProveX",
    address: "0xf6f8db0aba00007681f8faf16a0fda1c9b030b11",
    origin: "pulsechain",
    rh: false,
    core: true
  },
  {
    id: "ehex",
    symbol: "eHEX",
    displaySymbol: "eHEX",
    name: "eHEX (bridged from Ethereum)",
    address: "0x57fde0a71132198bbec939b98976993d8d89d225",
    origin: "bridged",
    rh: true,
    core: true
  },
  {
    id: "hdrn",
    symbol: "HDRN",
    displaySymbol: "HDRN",
    name: "Hedron",
    address: "0x3819f64f282bf135d62168c1e513280daf905e06",
    origin: "pulsechain",
    rh: true,
    core: false
  },
  {
    id: "icsa",
    symbol: "ICSA",
    displaySymbol: "ICSA",
    name: "Icosa",
    address: "0xfc4913214444af5c715cc9f7b52655e788a569ed",
    origin: "pulsechain",
    rh: true,
    core: false
  },
  {
    id: "dai",
    symbol: "DAI",
    displaySymbol: "DAI",
    name: "DAI (bridged from Ethereum)",
    address: "0xefd766ccb38eaf1dfd701853bfce31359239f305",
    origin: "bridged",
    rh: false,
    core: false
  },
  {
    id: "eusdc",
    symbol: "eUSDC",
    displaySymbol: "eUSDC",
    name: "eUSDC (bridged from Ethereum)",
    address: "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07",
    origin: "bridged",
    rh: false,
    core: false
  },
  {
    id: "eusdt",
    symbol: "eUSDT",
    displaySymbol: "eUSDT",
    name: "eUSDT (bridged from Ethereum)",
    address: "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f",
    origin: "bridged",
    rh: false,
    core: false
  }
]

var DEFAULT_COINS = CATALOG.filter(function (c) { return c.core }).map(function (c) {
  return catalogCoin(c)
})

var CATALOG_BY_ID = {}
var CATALOG_BY_ADDRESS = {}
for (var ci = 0; ci < CATALOG.length; ci++) {
  var item = CATALOG[ci]
  CATALOG_BY_ID[item.id] = item
  CATALOG_BY_ADDRESS[item.address.toLowerCase()] = item
}
