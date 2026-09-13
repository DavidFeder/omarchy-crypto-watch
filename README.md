# Pulse Watch

Fork of [Crypto Watch](https://github.com/victorrangel10/omarchy-crypto-watch) for **PulseChain** and Richard Heart coins.

The bar shows **HEX** (or whichever coin you pin) with a live PulseX price. Click **ticker** in the panel to put every coin on the bar as a scrolling tape. Click the pill for HEX, PLS, PLSX, INC, PRVX, and eHEX — distinct assets, not the same ticker twice.

Prices come from [DexScreener](https://dexscreener.com/pulsechain) PulseX pairs, not CoinGecko. That matters: CoinGecko’s PLS print is thin and often stale, and it collides HEX (ETH) with HEX (PulseChain).

## Defaults

| Bar / panel | Address on PulseChain | Origin |
|---|---|---|
| **HEX** (pHEX) | `0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39` | State-fork HEX — the PulseChain HEX |
| **PLS** | WPLS `0xA1077a294dDE1B09bB078844df40758a5D0f9a27` | Native |
| **PLSX** | `0x95B303987A60C71504D99Aa1b13B4DA07b0790ab` | PulseX |
| **INC** | `0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d` | PulseX incentive |
| **PRVX** | `0xF6f8Db0aBa00007681F8fAF16A0FDa1c9B030b11` | ProveX |
| **eHEX** | `0x57fde0a71132198BBeC939B98976993d8D89D225` | Bridged from Ethereum — **not** pHEX |

Add-coin also knows HDRN, ICSA, bridged DAI / eUSDC / eUSDT, and any other PulseChain token DexScreener returns.

Addresses follow [pulsechain-mcp token identity](https://github.com/DavidFeder/pulsechain-mcp/blob/main/docs/TOKEN_IDENTITY.md): ticker search is discovery-only; pHEX ≠ eHEX.

## Install

```bash
omarchy plugin add https://github.com/DavidFeder/omarchy-crypto-watch.git --enable
```

## Use

| Input | Action |
|---|---|
| Left-click bar | Open / close panel |
| Right-click bar | Cycle which coin is on the bar (single-coin mode) |
| Middle-click bar | Refresh now |
| **ticker** chip / `t` | Put all coins on the bar as a scrolling tape |
| Hover ticker | Pause the tape |
| `1h` / `6h` / `24h` | Change window (DexScreener native; there is no honest 7d) |
| Right-click a row | Pin that coin to the bar |
| `p` | Pin the highlighted row |
| `r` | Refresh |
| Add coin | RH catalog first, then PulseChain DexScreener search |

## Why this fork

Crypto Watch is a good CoinGecko watchlist. It is the wrong feed for PulseChain:

- Bar was only ₿
- Two HEX rows looked identical
- PLS printed as `$1.020e-5`
- Search ranked “Hex Trust USD” above HEX
- CoinGecko PLS volume is a few hundred dollars

Pulse Watch keeps the same Omarchy panel contract (Model.js + tests + PlainText + bounded fetch) and points it at PulseX.

## License

MIT. Original Crypto Watch © Victor Rangel; Pulse Watch modifications © David Feder.
