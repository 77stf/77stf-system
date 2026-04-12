import { NextResponse } from 'next/server'

// ─── GET /api/rates/market ────────────────────────────────────────────────────
// Returns: USD/PLN rate (NBP), BTC price (CoinGecko), ETH price, Gold XAU/USD (metals-api or fallback)
// All free APIs, no auth required. Cached 10 min via headers.

interface MarketData {
  usd_pln: number | null
  btc_usd: number | null
  eth_usd: number | null
  gold_usd: number | null   // XAU per troy ounce in USD
  gold_pln: number | null   // derived
  btc_change_24h: number | null
  eth_change_24h: number | null
  fetched_at: string
}

// Simple in-memory cache (per serverless instance, resets on cold start)
let cache: { data: MarketData; expires: number } | null = null
const CACHE_TTL_MS = 10 * 60 * 1000  // 10 min

async function fetchUsdPln(): Promise<number | null> {
  try {
    const res = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json', {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json() as { rates?: { mid?: number }[] }
    return data.rates?.[0]?.mid ?? null
  } catch { return null }
}

async function fetchCrypto(): Promise<{ btc: number | null; eth: number | null; btcChange: number | null; ethChange: number | null }> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
      { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return { btc: null, eth: null, btcChange: null, ethChange: null }
    const data = await res.json() as {
      bitcoin?: { usd?: number; usd_24h_change?: number }
      ethereum?: { usd?: number; usd_24h_change?: number }
    }
    return {
      btc: data.bitcoin?.usd ?? null,
      eth: data.ethereum?.usd ?? null,
      btcChange: data.bitcoin?.usd_24h_change ?? null,
      ethChange: data.ethereum?.usd_24h_change ?? null,
    }
  } catch { return { btc: null, eth: null, btcChange: null, ethChange: null } }
}

async function fetchGold(): Promise<number | null> {
  // Free source: Frankfurt Stock Exchange Gold ETF via frankfurter.app + metals-api fallback
  // Using open metals API (metals.live) — completely free, no key
  try {
    const res = await fetch('https://api.metals.live/v1/spot/gold', {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('metals.live failed')
    const data = await res.json() as Array<{ gold?: number }> | { gold?: number }
    const price = Array.isArray(data) ? data[0]?.gold : data?.gold
    if (typeof price === 'number' && price > 0) return price
    throw new Error('no price in response')
  } catch {
    // Fallback: try goldapi.io free tier (no auth for spot price endpoint)
    try {
      const res2 = await fetch('https://data-asg.goldprice.org/dbXRates/USD', {
        signal: AbortSignal.timeout(5000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; 77STF/1.0)',
        },
      })
      if (!res2.ok) return null
      const d2 = await res2.json() as { items?: Array<{ xauPrice?: number }> }
      return d2.items?.[0]?.xauPrice ?? null
    } catch { return null }
  }
}

export async function GET() {
  // Return cached data if fresh
  if (cache && Date.now() < cache.expires) {
    return NextResponse.json(cache.data, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
    })
  }

  // Fetch all in parallel
  const [usdPln, crypto, gold] = await Promise.all([
    fetchUsdPln(),
    fetchCrypto(),
    fetchGold(),
  ])

  const data: MarketData = {
    usd_pln: usdPln,
    btc_usd: crypto.btc,
    eth_usd: crypto.eth,
    gold_usd: gold,
    gold_pln: (gold && usdPln) ? Math.round(gold * usdPln) : null,
    btc_change_24h: crypto.btcChange,
    eth_change_24h: crypto.ethChange,
    fetched_at: new Date().toISOString(),
  }

  cache = { data, expires: Date.now() + CACHE_TTL_MS }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
  })
}
